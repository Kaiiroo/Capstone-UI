// Styled Excel (.xlsx) export of verified prescription records.
// ExcelJS is loaded on demand so pages that never export do not download it.

const TEAL = 'FF0E857E';
const TEAL_SOFT = 'FFE6F5F4';
const INK = 'FF1C2430';
const MUTED = 'FF6B7484';
const BORDER = 'FFD5DCE0';
const AMBER_SOFT = 'FFFDF0DC';
const AMBER_TEXT = 'FF8A4B08';
const GREEN_SOFT = 'FFE3F3E8';
const GREEN_TEXT = 'FF15803D';

const COLUMNS = [
  { header: 'No.', key: 'no', width: 6 },
  { header: 'Prescribing doctor', key: 'source', width: 26 },
  { header: 'Verified on', key: 'verifiedAt', width: 20 },
  { header: 'Diagnosis / stated purpose', key: 'diagnosis', width: 30 },
  { header: 'Medicine', key: 'medicine', width: 28 },
  { header: 'Dosage / instructions', key: 'dosage', width: 44 },
  { header: 'Reviewer edit', key: 'edited', width: 16 },
];

const thinBorder = { style: 'thin', color: { argb: BORDER } };
const allBorders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '';
}

function buildRows(records) {
  const rows = [];
  records.forEach((record, recordIndex) => {
    const items = record.items.length ? record.items : [{ medicine_name: '', dosage: '', is_edited: false }];
    items.forEach((item, itemIndex) => {
      rows.push({
        group: recordIndex,
        no: itemIndex === 0 ? recordIndex + 1 : '',
        source: record.source || 'N/A',
        verifiedAt: formatDateTime(record.verifiedAt),
        diagnosis: record.diagnosis || '',
        medicine: item.medicine_name,
        dosage: item.dosage,
        edited: item.medicine_name || item.dosage ? (item.is_edited ? 'Edited' : 'As recognized') : '',
      });
    });
  });
  return rows;
}

function addRecordsSheet(workbook, records, exportedBy) {
  const sheet = workbook.addWorksheet('Verified Prescriptions', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));
  const lastColumn = COLUMNS.length;

  sheet.mergeCells(1, 1, 1, lastColumn);
  const title = sheet.getCell(1, 1);
  title.value = 'GuadaHealth - Verified Prescription Records';
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  title.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 36;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = `Exported ${new Date().toLocaleString()} by ${exportedBy}   |   ${records.length} verified prescription${records.length === 1 ? '' : 's'}`;
  subtitle.font = { name: 'Calibri', size: 10, color: { argb: MUTED } };
  subtitle.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(2).height = 20;

  sheet.mergeCells(3, 1, 3, lastColumn);
  const note = sheet.getCell(3, 1);
  note.value = 'Every record below was reviewed by authorized staff. "Edited" means the reviewer changed the automatically recognized value.';
  note.font = { name: 'Calibri', size: 10, italic: true, color: { argb: MUTED } };
  note.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 8;

  const headerRow = sheet.getRow(5);
  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } };
    cell.alignment = { vertical: 'middle', horizontal: index === 0 ? 'center' : 'left', wrapText: true };
    cell.border = { ...allBorders, bottom: { style: 'medium', color: { argb: TEAL } } };
  });
  headerRow.height = 28;

  const rows = buildRows(records);
  rows.forEach((rowData) => {
    const row = sheet.addRow(rowData);
    const striped = rowData.group % 2 === 1;
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: INK } };
      cell.alignment = { vertical: 'middle', horizontal: columnNumber === 1 ? 'center' : 'left', wrapText: true };
      cell.border = allBorders;
      if (striped) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F9F9' } };
      }
    });

    const editedCell = row.getCell(lastColumn);
    if (rowData.edited === 'Edited') {
      editedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_SOFT } };
      editedCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: AMBER_TEXT } };
    } else if (rowData.edited) {
      editedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SOFT } };
      editedCell.font = { name: 'Calibri', size: 11, color: { argb: GREEN_TEXT } };
    }
    editedCell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: lastColumn } };
  return rows;
}

function addSummarySheet(workbook, records, rows, exportedBy) {
  const sheet = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 34 }, { width: 22 }];

  sheet.mergeCells('A1:B1');
  const title = sheet.getCell('A1');
  title.value = 'Export summary';
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  title.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 32;

  const medicineRows = rows.filter((row) => row.medicine || row.dosage);
  const editedRows = medicineRows.filter((row) => row.edited === 'Edited').length;
  const editRate = medicineRows.length ? editedRows / medicineRows.length : 0;

  const details = [
    ['Verified prescriptions', records.length],
    ['Medicine entries', medicineRows.length],
    ['Entries edited by reviewer', editedRows],
    ['Reviewer edit rate', editRate],
    ['Exported by', exportedBy],
    ['Exported on', new Date().toLocaleString()],
  ];

  details.forEach(([label, value], index) => {
    const row = sheet.getRow(3 + index);
    row.height = 24;
    const labelCell = row.getCell(1);
    const valueCell = row.getCell(2);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: INK } };
    valueCell.font = { name: 'Calibri', size: 11, color: { argb: INK } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } };
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    labelCell.alignment = { vertical: 'middle', indent: 1 };
    labelCell.border = allBorders;
    valueCell.border = allBorders;
    if (label === 'Reviewer edit rate') {
      valueCell.numFmt = '0.0%';
    }
  });

  sheet.mergeCells('A10:B11');
  const disclaimer = sheet.getCell('A10');
  disclaimer.value = 'Generated by PRESCRIBE-AID for administrative record keeping. It is not clinical advice.';
  disclaimer.font = { name: 'Calibri', size: 9, italic: true, color: { argb: MUTED } };
  disclaimer.alignment = { wrapText: true, vertical: 'top' };
}

export async function downloadVerifiedWorkbook(records, exportedBy, fileName) {
  const { default: ExcelJS } = await import('https://esm.sh/exceljs@4.4.0');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PRESCRIBE-AID';
  workbook.created = new Date();

  const rows = addRecordsSheet(workbook, records, exportedBy);
  addSummarySheet(workbook, records, rows, exportedBy);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}
