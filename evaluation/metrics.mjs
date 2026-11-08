// Accuracy metrics for PRESCRIBE-AID: CER and WER for OCR, Precision/Recall/F1 for field extraction.

// Collapses whitespace and line breaks; case and punctuation are kept, as in standard CER/WER.
export function normalizeText(text) {
  return String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

// Minimum substitutions + deletions + insertions to turn `hypothesis` into `reference`.
export function editDistance(reference, hypothesis) {
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  for (let i = 1; i <= reference.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= hypothesis.length; j += 1) {
      const substitution = previous[j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1);
      current.push(Math.min(substitution, previous[j] + 1, current[j - 1] + 1));
    }
    previous = current;
  }
  return previous[hypothesis.length];
}

export function characterErrors(referenceText, hypothesisText) {
  const reference = [...normalizeText(referenceText)];
  const hypothesis = [...normalizeText(hypothesisText)];
  return { errors: editDistance(reference, hypothesis), total: reference.length };
}

export function wordErrors(referenceText, hypothesisText) {
  const split = (text) => normalizeText(text).split(' ').filter(Boolean);
  const reference = split(referenceText);
  return { errors: editDistance(reference, split(hypothesisText)), total: reference.length };
}

export function errorRate({ errors, total }) {
  return total ? errors / total : 0;
}

// Field values are compared case-insensitively, ignoring spacing and surrounding punctuation.
export function normalizeField(value) {
  return normalizeText(value).toLowerCase().replace(/^[\s.,;:\-]+|[\s.,;:\-]+$/g, '');
}

// Dosage is scored on its strength ("500 mg" = "500mg"), since instructions are written in many ways.
// NFKC turns the micro sign (µ) into the Greek mu (μ), so only μg needs to be matched.
const STRENGTH_PATTERN = /(\d+(?:[.,]\d+)?)\s*(mcg|μg|mg|g|ml|iu|units?|%)/i;

export function normalizeDosage(value) {
  const match = String(value ?? '').normalize('NFKC').match(STRENGTH_PATTERN);
  if (!match) {
    return normalizeField(value);
  }
  const unit = match[2].toLowerCase().replace('μg', 'mcg').replace(/^units?$/, 'unit');
  return `${match[1].replace(',', '.')}${unit}`;
}

// Counts matches between two lists of values; each reference value can be matched once.
export function matchCounts(referenceValues, predictedValues) {
  const remaining = [...referenceValues];
  let truePositives = 0;
  for (const value of predictedValues) {
    const index = remaining.indexOf(value);
    if (index !== -1) {
      remaining.splice(index, 1);
      truePositives += 1;
    }
  }
  return {
    tp: truePositives,
    fp: predictedValues.length - truePositives,
    fn: referenceValues.length - truePositives,
  };
}

export function scoreFields(reference, predicted) {
  const nonEmpty = (values) => values.filter(Boolean);
  const diagnosisReference = normalizeField(reference.diagnosis);
  const diagnosisPredicted = normalizeField(predicted.diagnosis);

  return {
    medicine: matchCounts(
      nonEmpty(reference.medicines.map(normalizeField)),
      nonEmpty(predicted.medicines.map(normalizeField)),
    ),
    // A predicted dosage without a strength ("#21 caps 3x a day") is not a strength prediction.
    dosage: matchCounts(
      nonEmpty(reference.dosages.map(normalizeDosage)),
      nonEmpty(predicted.dosages.filter((value) => STRENGTH_PATTERN.test(normalizeText(value))).map(normalizeDosage)),
    ),
    diagnosis: matchCounts(nonEmpty([diagnosisReference]), nonEmpty([diagnosisPredicted])),
  };
}

// Close match: 1 minus the edit distance divided by the longer value's length (1 = identical).
export function similarity(a, b) {
  const longer = Math.max([...a].length, [...b].length);
  return longer ? 1 - editDistance([...a], [...b]) / longer : 1;
}

// Like matchCounts, but a predicted value matches the most similar unused reference value
// when they are at least `threshold` similar ("elecuxib" vs "celecoxib" = 0.78).
export function matchCountsNear(referenceValues, predictedValues, threshold) {
  const remaining = [...referenceValues];
  let truePositives = 0;
  for (const value of predictedValues) {
    let bestIndex = -1;
    let bestSimilarity = threshold;
    remaining.forEach((reference, index) => {
      const score = similarity(reference, value);
      if (score >= bestSimilarity) {
        bestIndex = index;
        bestSimilarity = score;
      }
    });
    if (bestIndex !== -1) {
      remaining.splice(bestIndex, 1);
      truePositives += 1;
    }
  }
  return {
    tp: truePositives,
    fp: predictedValues.length - truePositives,
    fn: referenceValues.length - truePositives,
  };
}

// The same fields as scoreFields, with medicine names and diagnoses counted as correct when close enough.
// Diagnoses need a higher similarity: they are long, so a wrong word changes the score less
// ("Hypotonic Stage 1" vs "Hypertension Stage I" is 83% similar but a different diagnosis).
// Dosage strength is still compared exactly, since a different number is a different dose.
export function scoreFieldsNear(reference, predicted, { medicine = 0.8, diagnosis = 0.9 } = {}) {
  const exact = scoreFields(reference, predicted);
  const nonEmpty = (values) => values.filter(Boolean);
  return {
    medicine: matchCountsNear(
      nonEmpty(reference.medicines.map(normalizeField)),
      nonEmpty(predicted.medicines.map(normalizeField)),
      medicine,
    ),
    dosage: exact.dosage,
    diagnosis: matchCountsNear(
      nonEmpty([normalizeField(reference.diagnosis)]),
      nonEmpty([normalizeField(predicted.diagnosis)]),
      diagnosis,
    ),
  };
}

export function precisionRecallF1({ tp, fp, fn }) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

export function addCounts(a, b) {
  return { tp: a.tp + b.tp, fp: a.fp + b.fp, fn: a.fn + b.fn };
}
