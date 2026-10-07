// Rule-based extraction of medicine, dosage, and diagnosis from OCR text.
// Only copies what is written in the text; it never infers a diagnosis or treatment.

const DOSAGE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|iu|units?|%|tabs?|tablets?|caps?|capsules?)\b(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:mg|ml|g))?/i;
const FORM_PREFIX = /^(?:\d+\s*[.)\-]\s*|[-*•]\s*)?(?:rx\s*[:.]?\s*)?(?:(?:tab|tabs|tablet|cap|caps|capsule|syr|syrup|susp|inj|amp|oint|cream|gtt|drops?)\.?\s+)?/i;
const DIAGNOSIS_PATTERN = /^\s*(?:dx|diagnosis|impression|imp|assessment|c\/o|for)\s*[:\-.]?\s*(.+)$/i;
const SKIP_LINE = /^(?:name|age|sex|date|address|patient|dr\.?|md|lic|ptr|s2|signature)\b/i;
const QUANTITY_PATTERN = /^#\s*\d+/;
const SIG_PREFIX = /^(?:sig|sg)\s*[.:]*\s*/i;
const INSTRUCTION_PATTERN = /\b(?:\d+\s*x\s*(?:a\s*)?(?:day|daily)|once|twice|thrice|daily|bid|tid|qid|qd|prn|hs|ac|pc|q\d+h?|every\s+\d+\s*hours?|before|after|with)\b/i;

function cleanLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

export function extractPrescriptionFields(text) {
  const lines = String(text || '').split(/\r?\n/).map(cleanLine).filter(Boolean);
  const items = [];
  let diagnosis = '';

  for (const line of lines) {
    const diagnosisMatch = line.match(DIAGNOSIS_PATTERN);
    if (diagnosisMatch && !DOSAGE_PATTERN.test(line)) {
      diagnosis = diagnosis || diagnosisMatch[1].trim();
      continue;
    }

    if (SKIP_LINE.test(line)) {
      continue;
    }

    const dosageMatch = line.match(DOSAGE_PATTERN);
    const beforeDosage = dosageMatch ? line.slice(0, dosageMatch.index) : '';
    const medicineName = beforeDosage.replace(FORM_PREFIX, '').replace(/[\s,:;\-]+$/, '').trim();

    const looksLikeMedicine = /[a-z]{3,}/i.test(medicineName) && !/^[#\d]/.test(medicineName) && !SIG_PREFIX.test(line);

    if (!dosageMatch || !looksLikeMedicine) {
      // Quantity ("#21 caps") and sig ("Sg.: 3x a day") lines continue the previous medicine.
      if (items.length && (QUANTITY_PATTERN.test(line) || SIG_PREFIX.test(line) || INSTRUCTION_PATTERN.test(line))) {
        const previous = items[items.length - 1];
        previous.dosage = `${previous.dosage} ${line.replace(SIG_PREFIX, '')}`.trim();
      }
      continue;
    }

    items.push({
      medicine_name: medicineName,
      dosage: line.slice(dosageMatch.index).trim(),
      confidence_score: null,
      is_edited: false,
    });
  }

  return { diagnosis, items };
}
