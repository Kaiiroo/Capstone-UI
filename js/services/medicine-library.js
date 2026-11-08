// Medicine library used to suggest the correct spelling of medicine names read by OCR:
// the PNF Essential Medicines List, common brand names with their generic names, and other common medicines.
import { BRAND_MEDICINES } from './brand-medicines.js';
import { PNF_MEDICINES } from './pnf-medicines.js';

// Prescribed at local clinics but not in the PNF EML, or spelled differently there; add clinic-specific names here.
export const OTHER_MEDICINES = [
  'Acetylcysteine', 'Aciclovir', 'Acyclovir', 'Albendazole', 'Allopurinol', 'Alprazolam', 'Ambroxol', 'Amitriptyline',
  'Amlodipine', 'Amoxicillin', 'Amoxicillin + Clavulanic Acid', 'Ampicillin', 'Ascorbic Acid', 'Aspirin', 'Atenolol',
  'Atorvastatin', 'Azithromycin', 'Beclomethasone', 'Betahistine', 'Betamethasone', 'Bisacodyl', 'Bisoprolol',
  'Budesonide', 'Butamirate', 'Cabergoline', 'Calcium Carbonate', 'Captopril', 'Carbamazepine', 'Carbocisteine', 'Carvedilol',
  'Cefalexin', 'Cefixime', 'Cefuroxime', 'Celecoxib', 'Cetirizine', 'Chloramphenicol', 'Chlorphenamine',
  'Cilostazol', 'Ciprofloxacin', 'Clarithromycin', 'Clindamycin', 'Clonazepam', 'Clopidogrel', 'Clotrimazole',
  'Cloxacillin', 'Co-amoxiclav', 'Colchicine', 'Cotrimoxazole', 'Dexamethasone', 'Dextromethorphan', 'Diazepam',
  'Diclofenac', 'Dicycloverine', 'Dienogest', 'Digoxin', 'Diphenhydramine', 'Domperidone', 'Doxycycline',
  'Empagliflozin', 'Enalapril', 'Erythromycin', 'Escitalopram', 'Esomeprazole', 'Ethambutol', 'Etoricoxib',
  'Famotidine', 'Febuxostat', 'Felodipine', 'Ferrous Sulfate', 'Fexofenadine', 'Fluconazole', 'Fluoxetine',
  'Folic Acid', 'Furosemide', 'Gabapentin', 'Gliclazide', 'Glimepiride', 'Guaifenesin', 'Hydralazine',
  'Hydrochlorothiazide', 'Hydrocortisone', 'Hydroxyzine', 'Hyoscine Butylbromide', 'Ibuprofen', 'Insulin Glargine',
  'Ipratropium', 'Irbesartan', 'Isoniazid', 'Isosorbide Mononitrate', 'Ketoconazole', 'Ketorolac', 'Lactulose',
  'Lagundi', 'Lansoprazole', 'Letrozole', 'Levocetirizine', 'Levofloxacin', 'Levothyroxine', 'Linagliptin',
  'Loperamide', 'Loratadine', 'Losartan', 'Losartan + Hydrochlorothiazide', 'Meclizine', 'Mefenamic Acid',
  'Meloxicam', 'Metformin', 'Methimazole', 'Methyldopa', 'Methylprednisolone', 'Metoclopramide', 'Metoprolol',
  'Metronidazole', 'Miconazole', 'Montelukast', 'Multivitamins', 'Mupirocin', 'Naproxen', 'Nifedipine',
  'Nitrofurantoin', 'Norethisterone', 'Nystatin', 'Omeprazole', 'Ondansetron', 'Oral Rehydration Salts',
  'Oseltamivir', 'Pantoprazole', 'Paracetamol', 'Phenylephrine', 'Phenytoin', 'Pioglitazone', 'Prednisone',
  'Pregabalin', 'Propranolol', 'Pyrazinamide', 'Rabeprazole', 'Ranitidine', 'Rifampicin', 'Rosuvastatin',
  'Salbutamol', 'Salmeterol + Fluticasone', 'Sambong', 'Sertraline', 'Simvastatin', 'Sitagliptin',
  'Sodium Bicarbonate', 'Spironolactone', 'Telmisartan', 'Terbinafine', 'Tamsulosin', 'Tramadol',
  'Tranexamic Acid', 'Trimetazidine', 'Valsartan', 'Vitamin B Complex', 'Vitamin D3', 'Zinc Sulfate',
];

const MIN_SIMILARITY = 0.6;

function normalize(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9+]/g, '');
}

// Brand name (normalized) -> generic name.
const GENERIC_BY_BRAND = new Map(BRAND_MEDICINES.map(([brand, generic]) => [normalize(brand), generic]));

// One entry per spelling: PNF names first, so a name in several sources keeps the PNF spelling.
function uniqueNames(names) {
  const seen = new Set();
  return names.filter((name) => {
    const key = normalize(name);
    return key && !seen.has(key) && seen.add(key);
  });
}

export const MEDICINE_LIBRARY = uniqueNames([
  ...PNF_MEDICINES,
  ...OTHER_MEDICINES,
  ...BRAND_MEDICINES.map(([brand]) => brand),
  ...BRAND_MEDICINES.flatMap(([, generic]) => [generic, ...generic.split(' + ')]),
]).sort((a, b) => a.localeCompare(b));

// Generic name of a brand name in the library ("Biogesic" -> "Paracetamol"), or '' for a generic name or unknown name.
export function genericOf(name) {
  const generic = GENERIC_BY_BRAND.get(normalize(name)) || '';
  return normalize(generic) === normalize(name) ? '' : generic;
}

function wordCount(name) {
  return String(name ?? '').split(/[\s-]+/).filter(Boolean).length;
}

function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(substitution, previous[j] + 1, current[j - 1] + 1));
    }
    previous = current;
  }
  return previous[b.length];
}

const NORMALIZED_LIBRARY = MEDICINE_LIBRARY.map((name) => ({ name, key: normalize(name) }));

export function isLibraryMedicine(name) {
  const key = normalize(name);
  return NORMALIZED_LIBRARY.some((entry) => entry.key === key);
}

// Auto-correction: at most this many letters off, and only for names long enough that a slip of
// one or two letters cannot turn one real medicine into another.
const AUTO_CORRECT_MAX_DISTANCE = 2;
const AUTO_CORRECT_MIN_LENGTH = 6;
// The next closest library name must be at least this many letters farther away, so the match is unambiguous.
const AUTO_CORRECT_MIN_MARGIN = 2;

// The closest and second-closest library names by edit distance.
function rankMatches(key) {
  let best = { name: '', distance: Infinity, similarity: 0 };
  let secondDistance = Infinity;
  for (const entry of NORMALIZED_LIBRARY) {
    const distance = editDistance(key, entry.key);
    if (distance < best.distance) {
      secondDistance = best.distance;
      best = { name: entry.name, distance, similarity: 1 - distance / Math.max(key.length, entry.key.length) };
    } else if (distance < secondDistance) {
      secondDistance = distance;
    }
  }
  return { best, secondDistance };
}

// Closest library name for a misspelled medicine ("elecuxib" -> "Celecoxib"), or '' when none is close.
export function suggestMedicine(name) {
  const key = normalize(name);
  if (key.length < 3 || isLibraryMedicine(name)) {
    return '';
  }

  const { best } = rankMatches(key);
  return best.similarity >= MIN_SIMILARITY ? best.name : '';
}

// Library name to replace a misspelled medicine with automatically, or '' when the match is not certain enough:
// the name must be one or two letters from exactly one library name. Anything less certain stays a suggestion.
export function autoCorrectMedicine(name) {
  const key = normalize(name);
  if (key.length < AUTO_CORRECT_MIN_LENGTH || isLibraryMedicine(name)) {
    return '';
  }

  const { best, secondDistance } = rankMatches(key);
  const closeEnough = best.distance <= AUTO_CORRECT_MAX_DISTANCE && best.distance <= Math.floor(key.length / 5);
  const unambiguous = secondDistance - best.distance >= AUTO_CORRECT_MIN_MARGIN;
  // An extra word usually names another product ("Allegra M", "Telvas AM", "Sompraz D"), not a typo.
  const addsWord = wordCount(name) > wordCount(best.name);
  return closeEnough && unambiguous && !addsWord ? best.name : '';
}
