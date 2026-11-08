// Runs each test image through the same Roboflow workflow and extraction code as the website,
// then computes CER, WER, and Precision/Recall/F1 against the ground truth.
//
//   node evaluation/evaluate.mjs            uses saved OCR outputs where they exist
//   node evaluation/evaluate.mjs --refresh  calls Roboflow again for every image
//   node evaluation/evaluate.mjs --only ph- scores only images whose name starts with "ph-"
//   node evaluation/evaluate.mjs --run claude  keeps this run's OCR outputs and results apart (raw-claude/, *-claude.md)
//   node evaluation/evaluate.mjs --saved-workflow  sends the saved workflow definition with each image, for when
//                                           Roboflow still serves an older published copy of the workflow
//   node evaluation/evaluate.mjs --library  also applies the medicine library's automatic corrections,
//                                           as the record editor does when a reviewer opens a record
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { extractPrescriptionFields } from '../js/services/extraction.js';
import { findOcrText } from '../js/services/ocr-response.js';
import { autoCorrectMedicine } from '../js/services/medicine-library.js';
import {
  addCounts,
  characterErrors,
  errorRate,
  precisionRecallF1,
  scoreFields,
  scoreFieldsNear,
  wordErrors,
} from './metrics.mjs';

// Close-match score: a medicine name or diagnosis at least this similar to the ground truth counts as correct.
const CLOSE_MATCH = { medicine: 0.8, diagnosis: 0.9 };

const EVALUATION_DIR = 'evaluation';
const GROUND_TRUTH_FILE = join(EVALUATION_DIR, 'ground-truth.csv');
const IMAGE_DIR = join(EVALUATION_DIR, 'test-set');
const RESULTS_DIR = join(EVALUATION_DIR, 'results');
const refresh = process.argv.includes('--refresh');
const runIndex = process.argv.indexOf('--run');
const runName = runIndex === -1 ? '' : (process.argv[runIndex + 1] || '').replace(/[^a-z0-9-]+/gi, '');
const useSavedWorkflow = process.argv.includes('--saved-workflow');
const RAW_DIR = join(RESULTS_DIR, runName ? `raw-${runName}` : 'raw');
const onlyIndex = process.argv.indexOf('--only');
// One prefix or several, comma-separated ("ph-,rx-01,rx-10").
const onlyPrefix = onlyIndex === -1 ? '' : process.argv[onlyIndex + 1] || '';
const onlyPrefixes = onlyPrefix.split(',').map((prefix) => prefix.trim()).filter(Boolean);
const useLibrary = process.argv.includes('--library');
const outputSuffix = `${runName ? `-${runName}` : ''}${onlyPrefix ? `-${onlyPrefix.replace(/[^a-z0-9]+/gi, '')}` : ''}${useLibrary ? '-library' : ''}`;
let libraryCorrections = 0;

function readConfigValue(name) {
  const config = readFileSync('js/config/roboflow.js', 'utf8');
  return config.match(new RegExp(`export const ${name}\\s*=\\s*['"]([^'"]*)['"]`))?.[1] || '';
}

function readApiKey() {
  if (process.env.ROBOFLOW_API_KEY) {
    return process.env.ROBOFLOW_API_KEY;
  }
  if (!existsSync('.env')) {
    return '';
  }
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('ROBOFLOW_API_KEY='));
  return line ? line.slice('ROBOFLOW_API_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
}

// Minimal CSV reader: handles quoted cells, commas, and line breaks inside quotes (as Excel saves them).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...body] = rows;
  const columns = header.map((name) => name.replace(/^﻿/, '').trim());
  return body
    .filter((cells) => cells.some((value) => value.trim()))
    .map((cells) => Object.fromEntries(columns.map((name, index) => [name, (cells[index] || '').trim()])));
}

const splitList = (value) => value.split(';').map((entry) => entry.trim()).filter(Boolean);

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const percent = (value) => `${(value * 100).toFixed(2)}%`;
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const standardDeviation = (values) => {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
};

const MIME_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// The saved (latest) workflow definition, fetched once.
let savedSpecification = null;
async function readSavedSpecification(apiKey, workspace, workflow) {
  if (!savedSpecification) {
    const response = await fetch(`https://api.roboflow.com/${workspace}/workflows/${workflow}?api_key=${apiKey}`);
    const body = await response.json();
    const config = typeof body.workflow?.config === 'string' ? JSON.parse(body.workflow.config) : body.workflow?.config;
    if (!config?.specification) {
      throw new Error(`Unable to read the saved workflow (${response.status}).`);
    }
    savedSpecification = config.specification;
  }
  return savedSpecification;
}

async function recognize(imageName, apiKey) {
  const cachePath = join(RAW_DIR, `${imageName}.json`);
  if (!refresh && existsSync(cachePath)) {
    // Re-read the text from the saved response so changes to findOcrText apply to cached runs.
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    return { ...cached, text: findOcrText(cached.response) };
  }

  if (!apiKey) {
    throw new Error('ROBOFLOW_API_KEY is not set. Add it to .env (see README).');
  }
  if (!MIME_TYPES[extname(imageName).toLowerCase()]) {
    throw new Error(`${imageName}: use a .jpg, .jpeg, .png, or .webp image.`);
  }

  const workspace = readConfigValue('ROBOFLOW_WORKSPACE');
  const workflow = readConfigValue('ROBOFLOW_WORKFLOW');
  const imageInput = readConfigValue('ROBOFLOW_IMAGE_INPUT') || 'image';
  const image = readFileSync(join(IMAGE_DIR, imageName)).toString('base64');

  const inputs = { [imageInput]: { type: 'base64', value: image } };
  const request = useSavedWorkflow
    ? {
      url: 'https://serverless.roboflow.com/workflows/run',
      headers: { 'Content-Type': 'application/json' },
      body: { api_key: apiKey, specification: await readSavedSpecification(apiKey, workspace, workflow), inputs },
    }
    : {
      url: `https://serverless.roboflow.com/${workspace}/workflows/${workflow}`,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: { inputs },
    };

  const startedAt = performance.now();
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(120_000),
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Never print an API key that a provider error may echo back.
    const detail = JSON.stringify(body).replace(/sk-ant-[\w-]+/g, '[key hidden]').slice(0, 200);
    throw new Error(`${imageName}: Roboflow returned ${response.status} ${detail}`);
  }

  const result = {
    image: imageName,
    recognizedAt: new Date().toISOString(),
    elapsedMs,
    coldStart: response.headers.get('x-model-cold-start'),
    text: findOcrText(body),
    response: body,
  };
  writeFileSync(cachePath, JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  if (!existsSync(GROUND_TRUTH_FILE)) {
    throw new Error(`Missing ${GROUND_TRUTH_FILE}. Copy ground-truth.template.csv to ground-truth.csv and fill it in.`);
  }
  mkdirSync(RAW_DIR, { recursive: true });

  const rows = parseCsv(readFileSync(GROUND_TRUTH_FILE, 'utf8')).filter((row) => !/^example/i.test(row.image))
    .filter((row) => !onlyPrefixes.length || onlyPrefixes.some((prefix) => row.image.startsWith(prefix)));
  if (!rows.length) {
    throw new Error(`${GROUND_TRUTH_FILE} has no prescriptions yet (EXAMPLE rows are skipped).`);
  }

  const apiKey = readApiKey();
  const perPrescription = [];
  const totals = {
    characters: { errors: 0, total: 0 },
    words: { errors: 0, total: 0 },
    medicine: { tp: 0, fp: 0, fn: 0 },
    dosage: { tp: 0, fp: 0, fn: 0 },
    diagnosis: { tp: 0, fp: 0, fn: 0 },
  };
  const nearTotals = {
    medicine: { tp: 0, fp: 0, fn: 0 },
    dosage: { tp: 0, fp: 0, fn: 0 },
    diagnosis: { tp: 0, fp: 0, fn: 0 },
  };

  for (const row of rows) {
    if (!existsSync(join(IMAGE_DIR, row.image))) {
      throw new Error(`${row.image} is listed in ground-truth.csv but is not in ${IMAGE_DIR}/.`);
    }

    process.stdout.write(`${row.image} ... `);
    const ocr = await recognize(row.image, apiKey);
    const extracted = extractPrescriptionFields(ocr.text);
    if (useLibrary) {
      for (const item of extracted.items) {
        const corrected = autoCorrectMedicine(item.medicine_name);
        if (corrected) {
          item.medicine_name = corrected;
          libraryCorrections += 1;
        }
      }
    }
    const characters = characterErrors(row.ground_truth_text, ocr.text);
    const words = wordErrors(row.ground_truth_text, ocr.text);
    const referenceFields = { medicines: splitList(row.medicines), dosages: splitList(row.dosages), diagnosis: row.diagnosis };
    const predictedFields = {
      medicines: extracted.items.map((item) => item.medicine_name),
      dosages: extracted.items.map((item) => item.dosage),
      diagnosis: extracted.diagnosis,
    };
    const fields = scoreFields(referenceFields, predictedFields);
    const nearFields = scoreFieldsNear(referenceFields, predictedFields, CLOSE_MATCH);

    totals.characters.errors += characters.errors;
    totals.characters.total += characters.total;
    totals.words.errors += words.errors;
    totals.words.total += words.total;
    for (const type of ['medicine', 'dosage', 'diagnosis']) {
      totals[type] = addCounts(totals[type], fields[type]);
      nearTotals[type] = addCounts(nearTotals[type], nearFields[type]);
    }

    const allFields = addCounts(addCounts(fields.medicine, fields.dosage), fields.diagnosis);
    perPrescription.push({
      image: row.image,
      ocrMs: ocr.elapsedMs,
      cer: errorRate(characters),
      wer: errorRate(words),
      characters,
      words,
      fields,
      f1: precisionRecallF1(allFields).f1,
      recognizedText: ocr.text,
      extractedMedicines: extracted.items.map((item) => `${item.medicine_name} | ${item.dosage}`).join('; '),
      extractedDiagnosis: extracted.diagnosis,
    });
    console.log(`CER ${percent(errorRate(characters))}  WER ${percent(errorRate(words))}`);
  }

  const header = [
    'image', 'ocr_seconds', 'reference_chars', 'char_errors', 'cer', 'reference_words', 'word_errors', 'wer',
    'medicine_tp', 'medicine_fp', 'medicine_fn', 'dosage_tp', 'dosage_fp', 'dosage_fn',
    'diagnosis_tp', 'diagnosis_fp', 'diagnosis_fn', 'field_f1',
    'recognized_text', 'extracted_medicines', 'extracted_diagnosis',
  ];
  const csvRows = perPrescription.map((entry) => [
    entry.image,
    (entry.ocrMs / 1000).toFixed(2),
    entry.characters.total, entry.characters.errors, percent(entry.cer),
    entry.words.total, entry.words.errors, percent(entry.wer),
    entry.fields.medicine.tp, entry.fields.medicine.fp, entry.fields.medicine.fn,
    entry.fields.dosage.tp, entry.fields.dosage.fp, entry.fields.dosage.fn,
    entry.fields.diagnosis.tp, entry.fields.diagnosis.fp, entry.fields.diagnosis.fn,
    percent(entry.f1),
    entry.recognizedText, entry.extractedMedicines, entry.extractedDiagnosis,
  ]);
  writeFileSync(
    join(RESULTS_DIR, `per-prescription${outputSuffix}.csv`),
    `﻿${[header, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`,
  );

  const ocrSeconds = perPrescription.map((entry) => entry.ocrMs / 1000);
  const cers = perPrescription.map((entry) => entry.cer);
  const wers = perPrescription.map((entry) => entry.wer);
  const fieldRow = (label, counts) => {
    const { precision, recall, f1 } = precisionRecallF1(counts);
    return `| ${label} | ${counts.tp} | ${counts.fp} | ${counts.fn} | ${percent(precision)} | ${percent(recall)} | ${percent(f1)} |`;
  };
  const allFieldCounts = addCounts(addCounts(totals.medicine, totals.dosage), totals.diagnosis);
  const nearAllFieldCounts = addCounts(addCounts(nearTotals.medicine, nearTotals.dosage), nearTotals.diagnosis);

  const summary = `# PRESCRIBE-AID accuracy results

Prescriptions evaluated: ${perPrescription.length}${onlyPrefix ? ` (images starting with "${onlyPrefix}")` : ''}${useLibrary ? `
Medicine library automatic corrections applied: ${libraryCorrections} medicine name(s)` : ''}
Generated: ${new Date().toLocaleString()}

## OCR accuracy (Statement of the Problem 1)

| Metric | Overall | Mean per prescription | SD |
|---|---|---|---|
| Character Error Rate (CER) | ${percent(errorRate(totals.characters))} (${totals.characters.errors} / ${totals.characters.total} characters) | ${percent(mean(cers))} | ${percent(standardDeviation(cers))} |
| Word Error Rate (WER) | ${percent(errorRate(totals.words))} (${totals.words.errors} / ${totals.words.total} words) | ${percent(mean(wers))} | ${percent(standardDeviation(wers))} |

Overall = total errors / total reference length across all prescriptions. Lower is better.

## Field extraction accuracy (Statement of the Problem 2)

| Field | TP | FP | FN | Precision | Recall | F1-score |
|---|---|---|---|---|---|---|
${fieldRow('Medicine name', totals.medicine)}
${fieldRow('Dosage (strength)', totals.dosage)}
${fieldRow('Diagnosis', totals.diagnosis)}
${fieldRow('All fields (micro-average)', allFieldCounts)}

A field is correct only if it matches the ground truth exactly (ignoring letter case and spacing).
Dosage is compared on its strength, for example "500 mg". A misread value counts as one FP and one FN.

### Close match (supplementary)

| Field | TP | FP | FN | Precision | Recall | F1-score |
|---|---|---|---|---|---|---|
${fieldRow('Medicine name', nearTotals.medicine)}
${fieldRow('Dosage (strength)', nearTotals.dosage)}
${fieldRow('Diagnosis', nearTotals.diagnosis)}
${fieldRow('All fields (micro-average)', nearAllFieldCounts)}

A medicine name counts as correct when it is at least ${Math.round(CLOSE_MATCH.medicine * 100)}% similar to the ground truth, and a diagnosis
at least ${Math.round(CLOSE_MATCH.diagnosis * 100)}% (similarity = 1 - edit distance / length of the longer value), e.g. "Amoxicilin" for
"Amoxicillin" (91%). Diagnoses need more because they are long. Dosage is still compared exactly.
This shows how close the output is for a reviewer to correct; the exact-match table above is the main result.

## OCR processing time

Mean ${mean(ocrSeconds).toFixed(2)} s, SD ${standardDeviation(ocrSeconds).toFixed(2)} s, \
min ${Math.min(...ocrSeconds).toFixed(2)} s, max ${Math.max(...ocrSeconds).toFixed(2)} s per prescription.
Times come from the first run of each image; re-run with --refresh to measure again.
`;
  writeFileSync(join(RESULTS_DIR, `summary${outputSuffix}.md`), summary);
  console.log(`\n${summary}`);
  console.log(`Saved ${join(RESULTS_DIR, `summary${outputSuffix}.md`)} and ${join(RESULTS_DIR, `per-prescription${outputSuffix}.csv`)}`);
}

main().catch((error) => {
  const cause = error.cause ? ` (${error.cause.code || error.cause.message})` : '';
  console.error(`\nError: ${error.message}${cause}. Network errors are often temporary: run the command again.`);
  process.exitCode = 1;
});
