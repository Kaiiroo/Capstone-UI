// Unit tests for the website's OCR cleanup and field extraction rules.
// Run: node --test evaluation/extraction.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPrescriptionFields } from '../js/services/extraction.js';
import { cleanOcrText } from '../js/services/ocr-response.js';

const names = (text) => extractPrescriptionFields(text).items.map((item) => item.medicine_name);

test('circled list numbers and blank form lines are cleaned', () => {
  assert.equal(cleanOcrText('$\\textcircled{1}$ PRAMIPEX\nDate : ___'), '(1) PRAMIPEX\nDate :');
});

test('medicine with a strength keeps working', () => {
  const { items } = extractPrescriptionFields('Amoxicillin 500mg\n#21 caps\nSg.: 3x a day for 7 days');
  assert.deepEqual(items.map((item) => [item.medicine_name, item.dosage]), [
    ['Amoxicillin', '500mg #21 caps 3x a day for 7 days'],
  ]);
});

test('list numbers and form words are removed from the name', () => {
  assert.deepEqual(names('1. T. Losar H 1-0-0\n(2) Cap. Enzar forte x 15 days\n- Syp Ascoril 5ml TDS'), [
    'Losar H', 'Enzar forte', 'Ascoril',
  ]);
});

test('listed medicines without a strength are found, cut before forms and directions', () => {
  assert.deepEqual(names('2. SOFRADEX OINTMENT BD x 7 DAYS\n3. Calasoft lotion x 7 days'), ['SOFRADEX', 'Calasoft']);
});

test('a name followed by a quantity is a medicine', () => {
  assert.deepEqual(names('FeSO4 tab #30\nSig: once a day\nAscorbic Acid\n#30\nSig: once a day'), [
    'FeSO4', 'Ascorbic Acid',
  ]);
});

test('phone, order, and license numbers after "#" are not quantities', () => {
  assert.deepEqual(names('Tel # 523-6913\nOrder # 4405352-1\nPermis # 75439'), []);
});

test('directions and long printed lines are not medicines', () => {
  assert.deepEqual(names('1. Take 1 tablet 3x a day\nRx: ILLEGAL IF NOT SAFETY BLUE BACKGROUND'), []);
});

test('laboratory and imaging requests are not medicines', () => {
  assert.deepEqual(names('Rx\n- CBC w/ PC\n- Urinalysis\n- lipid profile\n2. Ultrasound bilateral\n- Celecoxib 200mg cap'), ['Celecoxib']);
});

test('medical certificate diagnosis is read across lines', () => {
  const text = 'My Diagnosis is: Traumatic Anterior Shoulder\nInstability, left\n(Bankart lesion)\nRemarks/Recommendations: Fit to work';
  assert.equal(extractPrescriptionFields(text).diagnosis, 'Traumatic Anterior Shoulder Instability, left (Bankart lesion)');
});

test('diagnosis label on its own line takes the next line', () => {
  assert.equal(extractPrescriptionFields('the following diagnosis:\nAnterolisthesis, L5 - S1\nProcedures done:').diagnosis, 'Anterolisthesis, L5 - S1');
});

test('a diagnosis stops before the medicines', () => {
  const { diagnosis, items } = extractPrescriptionFields('Dx: Acute tonsillitis\nAmoxicillin 500mg\n#21 caps');
  assert.equal(diagnosis, 'Acute tonsillitis');
  assert.deepEqual(items.map((item) => item.medicine_name), ['Amoxicillin']);
});

test('certificate remarks are not medicines', () => {
  const text = 'My Diagnosis is: Costochondritis\nRemarks/Recommendations: - Given c meds\n- Rest for 3 days\n- To resume work on Monday';
  assert.deepEqual(extractPrescriptionFields(text), { diagnosis: 'Costochondritis', items: [] });
});

test('"For" is not a diagnosis label', () => {
  assert.equal(extractPrescriptionFields('For Anirban Roy Chowdhury\nDx: Acute tonsillitis').diagnosis, 'Acute tonsillitis');
});
