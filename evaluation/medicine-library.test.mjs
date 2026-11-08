// Tests for the medicine library's suggestions and automatic corrections.
// Run: node --test evaluation/medicine-library.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_MEDICINES } from '../js/services/brand-medicines.js';
import { MEDICINE_LIBRARY, autoCorrectMedicine, genericOf, suggestMedicine } from '../js/services/medicine-library.js';

// Typical OCR slips applied to every library name: one wrong, missing, or extra letter.
function misspell(name, position, kind) {
  const letters = [...name];
  const index = Math.min(position, letters.length - 1);
  if (kind === 'drop') {
    letters.splice(index, 1);
  } else if (kind === 'double') {
    letters.splice(index, 0, letters.at(index));
  } else {
    letters[index] = letters.at(index).toLowerCase() === 'x' ? 'z' : 'x';
  }
  return letters.join('');
}

test('every library name is recognized as written, so it is never changed', () => {
  for (const name of MEDICINE_LIBRARY) {
    assert.equal(autoCorrectMedicine(name), '', name);
    assert.equal(suggestMedicine(name), '', name);
  }
});

test('a one-letter slip in any library name is never corrected to a different medicine', () => {
  for (const name of MEDICINE_LIBRARY) {
    for (const kind of ['drop', 'double', 'swap']) {
      const misspelled = misspell(name, Math.floor(name.length / 2), kind);
      const corrected = autoCorrectMedicine(misspelled);
      if (corrected) {
        assert.equal(corrected, name, `${misspelled} was corrected to ${corrected}`);
      }
    }
  }
});

test('most one-letter slips in long names are corrected automatically', () => {
  const longNames = MEDICINE_LIBRARY.filter((name) => name.replace(/[^a-z]/gi, '').length >= 8);
  const corrected = longNames.filter((name) => autoCorrectMedicine(misspell(name, Math.floor(name.length / 2), 'drop')) === name);
  assert.ok(corrected.length / longNames.length > 0.8, `${corrected.length} of ${longNames.length}`);
});

test('OCR misreads from the test set', () => {
  assert.equal(autoCorrectMedicine('Paracetmol'), 'Paracetamol');
  assert.equal(autoCorrectMedicine('Carbamazepina'), 'Carbamazepine');
  assert.equal(autoCorrectMedicine('Feluxosat'), '');
  assert.equal(suggestMedicine('Feluxosat'), 'Febuxostat');
});

test('every brand name has its generic name, and misspelled brands are corrected to the brand', () => {
  for (const [brand, generic] of BRAND_MEDICINES) {
    if (brand.toLowerCase() !== generic.toLowerCase()) {
      assert.equal(genericOf(brand), generic, brand);
    }
  }
  assert.equal(genericOf('Paracetamol'), '');
  assert.equal(autoCorrectMedicine('Biogesik'), 'Biogesic');
});

test('a brand with an added word or letter is another product, so it is not auto-corrected', () => {
  for (const [brand] of BRAND_MEDICINES) {
    for (const suffix of [' M', ' AM', ' D', '-D', ' Forte', ' Plus']) {
      assert.equal(autoCorrectMedicine(`${brand}${suffix}`), '', `${brand}${suffix}`);
    }
  }
});

test('short, distant, or unknown names are left as they are', () => {
  assert.equal(autoCorrectMedicine('Zinx'), '');
  assert.equal(autoCorrectMedicine('American flu'), '');
  assert.equal(autoCorrectMedicine('Biogesic'), '');
  assert.equal(autoCorrectMedicine(''), '');
});
