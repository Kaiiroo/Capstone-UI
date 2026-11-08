# Accuracy evaluation (CER, WER, Precision, Recall, F1)

`evaluate.mjs` sends each test image through the same Roboflow workflow and the
same extraction code as the website, then compares the output with a ground
truth typed by the researchers. It answers Statement of the Problem 1 (OCR
accuracy: CER, WER) and 2 (field extraction: Precision, Recall, F1-score), and
records OCR processing time per prescription.

## 1. Prepare the test set

1. Put 30-50 prescription images in `evaluation/test-set/` (.jpg, .png or .webp).
   Use de-identified images: cover patient names, addresses, and license
   numbers before photographing or scanning. Do not use images that were used
   to tune the extraction rules.
2. Copy `ground-truth.template.csv` to `ground-truth.csv` and add one row per
   image. Open it in Excel; use Alt+Enter for line breaks inside a cell.

| Column | What to type |
|---|---|
| `image` | File name in `test-set/`, e.g. `rx-01.jpg` |
| `ground_truth_text` | Everything visible on the page, printed and handwritten, exactly as written. Spelling mistakes by the doctor stay as written. |
| `medicines` | Medicine names, separated by `;` |
| `dosages` | Strengths in the same order, separated by `;` (e.g. `500 mg; 250 mg`). Leave out a strength that is not written. |
| `diagnosis` | The diagnosis only if it is written on the prescription; otherwise leave empty. |

Rows whose image name starts with `EXAMPLE` are skipped.

Two researchers should transcribe each image independently and resolve any
differences together. Every metric is only as correct as this file.

3. Save `ground-truth.csv` as **CSV UTF-8** (File > Save As in Excel).

## 2. Run

From the project folder, with `ROBOFLOW_API_KEY` in `.env`:

```powershell
node evaluation/evaluate.mjs
```

The first run calls Roboflow once per image and saves each raw output in
`evaluation/results/raw/`. Later runs reuse those saved outputs, so the numbers
stay the same while you fix the ground truth. Use `--refresh` to call Roboflow
again. Report the results of a single run of the full test set and note its
date, because the workflow can return different text on different runs.

If a run stops with "fetch failed", run it again; images already processed are
not sent twice.

## 3. Results

- `results/summary.md`: tables for Chapter 4 (overall CER/WER, mean and SD per
  prescription, Precision/Recall/F1 per field, OCR time).
- `results/per-prescription.csv`: one row per image with the recognized text
  and extracted fields, for the appendix.

The test set, ground truth, and results are git-ignored because they contain
prescription data.

## How the metrics are computed

- **CER** = (substitutions + deletions + insertions) / characters in the ground
  truth. **WER** is the same over words. Spaces and line breaks are collapsed
  first; letter case and punctuation count.
- **Overall** CER/WER divides total errors by total ground-truth length across
  all images. **Mean** is the average of the per-image rates.
- **Precision** = TP / (TP + FP), **Recall** = TP / (TP + FN),
  **F1** = 2PR / (P + R), counted per field type and micro-averaged.
- A field is correct only if it matches the ground truth exactly, ignoring case
  and spacing. Dosage is compared on its strength ("500mg" = "500 mg"); an
  extracted dosage with no strength in it (e.g. "#21 caps") is not counted.
  A misread value counts as one false positive and one false negative.
- **Close match** (supplementary table): a medicine name counts as correct when it
  is at least 80% similar to the ground truth, and a diagnosis at least 90%
  (similarity = 1 - edit distance / length of the longer value). It shows how close
  the output is for a reviewer to correct. The exact-match table is the main result.

## Unit tests

```powershell
node --test evaluation/metrics.test.mjs evaluation/extraction.test.mjs evaluation/medicine-library.test.mjs
```
