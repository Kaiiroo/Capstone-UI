// Rule-based extraction of medicine, dosage, and diagnosis from OCR text.
// Only copies what is written in the text; it never infers a diagnosis or treatment.

const DOSAGE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|g|ml|iu|units?|%|tabs?|tablets?|caps?|capsules?)(?![a-z])(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:mg|ml|g)\b)?/i;
const FORM_WORDS = 'tabs?|tablets?|t|tb|caps?|capsules?|syp|syr|syrup|susp|suspension|inj|injection|amp|oint|ointment|cream|gel|lotion|soap|gtt|drops?|mdi|sol|solution';
// List markers: "1.", "2)", "(3)", "-", "*", "•", and an optional leading "Rx".
const LIST_MARKER = /^(?:\(?\d{1,2}\s*[.)]\)?\s*|\(\d{1,2}\)\s*|[-*•]\s*)/;
const FORM_PREFIX = new RegExp(`^(?:(?:${FORM_WORDS})\\.?\\s+)`, 'i');
const RX_PREFIX = /^rx\s*[:.]?\s*/i;
const FORM_WORD = new RegExp(`^(?:${FORM_WORDS})\\.?$`, 'i');
// "Dx:", "Imp:", and the medical certificate labels "My Diagnosis is:" and "the following diagnosis:".
const DIAGNOSIS_PATTERN = /^\s*(?:my\s+diagnosis\s+is|(?:the\s+following\s+)?diagnosis(?:\s+is)?|dx|impression|imp|assessment|c\/o)(?![a-z])\s*[:\-.]?\s*(.*)$/i;
// Lines that end a diagnosis written over several lines.
const DIAGNOSIS_STOP = /^(?:rx|req|remarks|recommendations?|procedures?|this\s+certif|attending|internal\s+medicine|m\.?d\b|sig|sg)\b|recommendations?\s*:/i;
// Medical certificate advice ("- Rest for 3 days") is listed like medicines but is not; "Rx" starts a prescription again.
const REMARKS_START = /^(?:remarks|recommendations?)\b|recommendations?\s*:/i;
const MAX_DIAGNOSIS_LINES = 3;
// Laboratory and imaging requests are listed like medicines ("- CBC", "2. Urinalysis") but are not medicines.
const LAB_REQUEST = /^(?:cbc|ua|urinalysis|fbs|rbs|hba1c|lipid|bun|crea|creatinine|sgpt|sgot|ast|alt|uric|na|k|cl|electrolytes?|potassium|sodium|tsh|ft4|troponin|ecg|12l\s*ecg|cxr|chest|x-?ray|ultrasound|utz|tvs|ct|mri|2d\s*echo|scan|fecalysis|stool)\b/i;
const SKIP_LINE = /^(?:name|age|sex|date|address|patient|dr\.?|md|lic|ptr|s2|signature)\b/i;
const QUANTITY_PATTERN = /^#\s*\d+/;
// Quantities have 1-3 digits; longer numbers after "#" are phone, order, or license numbers ("Tel # 523-6913").
const INLINE_QUANTITY = /\s#\s*\d{1,3}(?![\d-])/;
const SIG_PREFIX = /^(?:sig|sg)\s*[.:]*\s*/i;
const DIRECTION_START = /^(?:take|apply|instill|inhale|use|give|stop|continue|cont|add|review|repeat)\b/i;
const INSTRUCTION_PATTERN = /\b(?:\d+\s*x\s*(?:a\s*)?(?:day|daily)|once|twice|thrice|daily|bid|tid|qid|qd|prn|hs|ac|pc|q\d+h?|every\s+\d+\s*hours?|before|after|with)\b/i;
// Words that end a medicine name: frequencies, durations, and connectors.
const NAME_STOP_WORD = /^(?:x|for|once|twice|thrice|daily|od|bd|bid|tds|tid|qid|qd|hs|sos|prn|stat|ac|pc|before|after|with|at|in|per|every|morning|night|noon|bedtime|days?|weeks?|months?)\b\.?$/i;

function cleanLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

// Removes list numbers, "Rx", and form words ("Tab.", "Cap") from the start of a line.
function stripPrefixes(text) {
  let result = text;
  let previous;
  do {
    previous = result;
    result = result.replace(LIST_MARKER, '').replace(RX_PREFIX, '').replace(FORM_PREFIX, '');
  } while (result !== previous);
  return result;
}

// Keeps the words of the name and stops at a number, separator, instruction, or trailing form word.
function takeMedicineName(text) {
  const words = [];
  for (const word of text.split(' ')) {
    if (!word || /^[\d#½¼(\[—–\-→:=+<>~/]/.test(word) || NAME_STOP_WORD.test(word)) {
      break;
    }
    if (words.length && FORM_WORD.test(word)) {
      break;
    }
    words.push(word);
  }
  return words.join(' ').replace(/[\s,:;.\-—–]+$/, '').trim();
}

// Medicine names are short; longer runs of words are printed form text ("Rx: ILLEGAL IF NOT SAFETY BLUE...").
const MAX_NAME_WORDS = 4;

function looksLikeMedicine(name, line) {
  return /[a-z]{3,}/i.test(name)
    && name.split(' ').length <= MAX_NAME_WORDS
    && !LAB_REQUEST.test(name)
    && !SIG_PREFIX.test(line)
    && !DIRECTION_START.test(name);
}

export function extractPrescriptionFields(text) {
  const lines = String(text || '').split(/\r?\n/).map(cleanLine).filter(Boolean);
  const items = [];
  let diagnosis = '';
  // A name-like line without a strength, kept in case the next line is its quantity ("#21 caps").
  let pendingName = '';
  // Lines left that may continue the diagnosis on the following lines.
  let diagnosisLinesLeft = 0;
  let inRemarks = false;

  for (const line of lines) {
    if (REMARKS_START.test(line)) {
      inRemarks = true;
    } else if (RX_PREFIX.test(line)) {
      inRemarks = false;
    }
    if (pendingName && QUANTITY_PATTERN.test(line)) {
      items.push({ medicine_name: pendingName, dosage: '', confidence_score: null, is_edited: false });
    }
    pendingName = '';

    const diagnosisMatch = line.match(DIAGNOSIS_PATTERN);
    if (diagnosisMatch && !DOSAGE_PATTERN.test(line)) {
      if (!diagnosis) {
        diagnosis = diagnosisMatch[1].trim();
        diagnosisLinesLeft = MAX_DIAGNOSIS_LINES;
      }
      continue;
    }

    if (diagnosisLinesLeft > 0) {
      const endsDiagnosis = DIAGNOSIS_STOP.test(line) || SKIP_LINE.test(line) || LIST_MARKER.test(line)
        || DOSAGE_PATTERN.test(line) || QUANTITY_PATTERN.test(line);
      if (endsDiagnosis) {
        diagnosisLinesLeft = 0;
      } else {
        diagnosis = `${diagnosis} ${line}`.trim();
        diagnosisLinesLeft -= 1;
        continue;
      }
    }

    if (SKIP_LINE.test(line) || inRemarks) {
      continue;
    }

    const body = stripPrefixes(line);
    const hasListMarker = body !== line;
    const dosageMatch = body.match(DOSAGE_PATTERN);
    const medicineName = takeMedicineName(dosageMatch ? body.slice(0, dosageMatch.index) : body);

    // A medicine line has a strength ("Amoxicillin 500mg"), a quantity ("FeSO4 tab #30"),
    // or starts like a list item ("2. Allegra M", "Cap. Enzar").
    const nameLike = looksLikeMedicine(medicineName, line);
    const isMedicine = nameLike && (dosageMatch || hasListMarker || INLINE_QUANTITY.test(body));

    if (!isMedicine) {
      if (nameLike && !QUANTITY_PATTERN.test(line) && !INSTRUCTION_PATTERN.test(line)) {
        pendingName = medicineName;
      }
      // Quantity ("#21 caps") and sig ("Sg.: 3x a day") lines continue the previous medicine.
      if (items.length && (QUANTITY_PATTERN.test(line) || SIG_PREFIX.test(line) || INSTRUCTION_PATTERN.test(line))) {
        const previous = items[items.length - 1];
        previous.dosage = `${previous.dosage} ${line.replace(SIG_PREFIX, '')}`.trim();
      }
      continue;
    }

    items.push({
      medicine_name: medicineName,
      dosage: dosageMatch ? body.slice(dosageMatch.index).trim() : '',
      confidence_score: null,
      is_edited: false,
    });
  }

  return { diagnosis, items };
}
