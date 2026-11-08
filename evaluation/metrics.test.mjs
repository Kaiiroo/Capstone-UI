// Unit tests for the metric functions, checked against hand-computed values.
// Run: node --test evaluation/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  characterErrors,
  editDistance,
  errorRate,
  matchCounts,
  normalizeDosage,
  precisionRecallF1,
  scoreFields,
  scoreFieldsNear,
  similarity,
  wordErrors,
} from './metrics.mjs';

test('edit distance counts substitutions, deletions, and insertions', () => {
  assert.equal(editDistance([...'kitten'], [...'kitten']), 0);
  assert.equal(editDistance([...'kitten'], [...'sitten']), 1);
  assert.equal(editDistance([...'kitten'], [...'kiten']), 1);
  assert.equal(editDistance([...'kitten'], [...'kittens']), 1);
  assert.equal(editDistance([...'kitten'], [...'sitting']), 3);
  assert.equal(editDistance([], [...'abc']), 3);
});

test('CER: one missing letter in "Amoxicillin 500 mg"', () => {
  const result = characterErrors('Amoxicillin 500 mg', 'Amoxicilin 500 mg');
  assert.deepEqual(result, { errors: 1, total: 18 });
  assert.equal(errorRate(result), 1 / 18);
});

test('CER ignores extra spaces and line breaks', () => {
  assert.equal(characterErrors('Amoxicillin 500 mg\n#21 caps', 'Amoxicillin  500 mg #21 caps').errors, 0);
});

test('WER: one misspelled word out of three', () => {
  assert.deepEqual(wordErrors('Amoxicillin 500 mg', 'Amoxicilin 500 mg'), { errors: 1, total: 3 });
});

test('error rate of an empty reference is zero, not a division error', () => {
  assert.equal(errorRate(characterErrors('', 'anything')), 0);
});

test('dosage strength ignores spacing and unit case', () => {
  assert.equal(normalizeDosage('500 MG cap 3x a day'), normalizeDosage('500mg'));
  assert.equal(normalizeDosage('2,5 ml'), '2.5ml');
  assert.equal(normalizeDosage('50µg'), '50mcg');
  assert.equal(normalizeDosage('50μg'), '50mcg');
});

test('each reference value matches at most once', () => {
  assert.deepEqual(matchCounts(['a'], ['a', 'a']), { tp: 1, fp: 1, fn: 0 });
});

test('a misread medicine counts as one false positive and one false negative', () => {
  const counts = scoreFields(
    { medicines: ['Amoxicillin', 'Paracetamol'], dosages: ['500 mg', '500 mg'], diagnosis: 'Tonsillitis' },
    { medicines: ['Amoxicilin', 'Paracetamol'], dosages: ['500mg', '500 mg'], diagnosis: '' },
  );
  assert.deepEqual(counts.medicine, { tp: 1, fp: 1, fn: 1 });
  assert.deepEqual(counts.dosage, { tp: 2, fp: 0, fn: 0 });
  assert.deepEqual(counts.diagnosis, { tp: 0, fp: 0, fn: 1 });
});

test('close match counts a near-miss as correct, but not a different word', () => {
  const counts = scoreFieldsNear(
    { medicines: ['Amoxicillin', 'Paracetamol'], dosages: ['500 mg'], diagnosis: 'Acute tonsillitis' },
    { medicines: ['Amoxicilin', 'Ibuprofen'], dosages: ['250 mg'], diagnosis: 'Acute tonsilitis' },
  );
  assert.deepEqual(counts.medicine, { tp: 1, fp: 1, fn: 1 });
  assert.deepEqual(counts.dosage, { tp: 0, fp: 1, fn: 1 });
  assert.deepEqual(counts.diagnosis, { tp: 1, fp: 0, fn: 0 });
  assert.equal(similarity('abc', 'abc'), 1);
});

test('precision, recall, and F1', () => {
  const { precision, recall, f1 } = precisionRecallF1({ tp: 3, fp: 1, fn: 2 });
  assert.equal(precision, 0.75);
  assert.equal(recall, 0.6);
  assert.ok(Math.abs(f1 - 2 / 3) < 1e-12);
});

test('no predictions and no reference gives zeros instead of NaN', () => {
  assert.deepEqual(precisionRecallF1({ tp: 0, fp: 0, fn: 0 }), { precision: 0, recall: 0, f1: 0 });
});
