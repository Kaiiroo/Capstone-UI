// Drives the transcription progress bar from the OCR pipeline's progress events.
// The bar takes over the scan button's slot while it runs, then hands it back.
//
// Stages and the share of the bar each one owns:
//   read     0–8%   FileReader progress (real bytes read)
//   upload   8–25%  XHR upload progress (real bytes sent)
//   analyze 25–92%  Roboflow is working; no signal from the server, so the bar eases
//                   toward 92% based on how long previous runs took on this browser
//   finalize 92–100% response download + parsing (real bytes received)

const STAGES = {
  read: { start: 0, end: 8, label: 'Reading document' },
  upload: { start: 8, end: 25, label: 'Uploading to OCR service' },
  analyze: { start: 25, end: 92, label: 'Analyzing handwriting' },
  finalize: { start: 92, end: 100, label: 'Finalizing transcription' },
};
const STAGE_ORDER = Object.keys(STAGES);

const DURATION_KEY = 'gh-ocr-analyze-ms'; 
const DEFAULT_ANALYZE_MS = 8000;

function readExpectedAnalyzeMs() {
  try {
    const stored = Number(window.localStorage.getItem(DURATION_KEY));
    return stored > 0 ? stored : DEFAULT_ANALYZE_MS;
  } catch {
    return DEFAULT_ANALYZE_MS;
  }
}

function rememberAnalyzeMs(durationMs) {
  try {
    // Weighted average so one slow cold start doesn't skew future estimates.
    const blended = Math.round(readExpectedAnalyzeMs() * 0.6 + durationMs * 0.4);
    window.localStorage.setItem(DURATION_KEY, String(blended));
  } catch {
    // Storage unavailable; keep the default estimate.
  }
}

export function createTranscriptionProgress(root) {
  const label = root.querySelector('#transcription-progress-label');
  const value = root.querySelector('#transcription-progress-value');
  const fill = root.querySelector('.progress');

  let percent = 0;
  let currentStage = '';
  let analyzeStartedAt = 0;
  let tickId = 0;
  let hideId = 0;

  function render(text) {
    const rounded = Math.floor(percent);
    fill.style.width = `${percent}%`;
    value.textContent = `${rounded}%`;
    root.setAttribute('aria-valuenow', String(rounded));
    if (text) {
      label.textContent = text;
    }
  }

  function setPercent(next, text) {
    // Never move backwards; stages report independently.
    percent = Math.min(100, Math.max(percent, next));
    render(text);
  }

  function stageLabel(stage) {
    return `Step ${STAGE_ORDER.indexOf(stage) + 1}/${STAGE_ORDER.length} · ${STAGES[stage].label}`;
  }

  function hideAfter(delayMs) {
    window.clearTimeout(hideId);
    hideId = window.setTimeout(() => {
      root.hidden = true;
    }, delayMs);
  }

  function stopAnalyzeTicker() {
    window.cancelAnimationFrame(tickId);
    tickId = 0;
  }

  function startAnalyzeTicker() {
    const { start, end } = STAGES.analyze;
    const expectedMs = readExpectedAnalyzeMs();
    analyzeStartedAt = performance.now();

    const tick = () => {
      const elapsedMs = performance.now() - analyzeStartedAt;
      // Exponential ease: ~80% of the stage at the expected duration, never reaching the end.
      const fraction = 1 - Math.exp(-elapsedMs / (expectedMs * 0.6));
      const seconds = Math.floor(elapsedMs / 1000);
      setPercent(start + (end - start) * fraction, `${stageLabel('analyze')}… ${seconds}s`);
      tickId = window.requestAnimationFrame(tick);
    };
    tick();
  }

  function enterStage(stage) {
    if (stage === currentStage) {
      return;
    }
    if (currentStage === 'analyze') {
      stopAnalyzeTicker();
      rememberAnalyzeMs(performance.now() - analyzeStartedAt);
    }

    currentStage = stage;
    setPercent(STAGES[stage].start, `${stageLabel(stage)}…`);
    if (stage === 'analyze') {
      startAnalyzeTicker();
    }
  }

  return {
    start() {
      window.clearTimeout(hideId);
      stopAnalyzeTicker();
      percent = 0;
      currentStage = '';
      root.classList.remove('is-complete', 'is-error');
      root.hidden = false;
      render('Preparing document…');
      enterStage('read');
    },

    // Called by the OCR service: { stage, fraction } where fraction is 0–1 or null.
    update({ stage, fraction }) {
      enterStage(stage);
      if (stage !== 'analyze' && typeof fraction === 'number') {
        const { start, end } = STAGES[stage];
        setPercent(start + (end - start) * fraction);
      }
    },

    complete() {
      stopAnalyzeTicker();
      currentStage = '';
      setPercent(100, 'Transcription complete');
      root.classList.add('is-complete');
      hideAfter(1600);
    },

    fail(message) {
      stopAnalyzeTicker();
      currentStage = '';
      root.classList.add('is-error');
      render(message || 'Transcription failed');
      // The full error stays in the output box; give the button back so the user can retry.
      hideAfter(3500);
    },
  };
}
