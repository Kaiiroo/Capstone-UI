import {
  authStatus,
  logoutBtn,
  recordModal,
  recordModalClose,
  recordModalImage,
  recordModalImagePlaceholder,
  recordModalSave,
  recordModalVerify,
  recordModalDiagnosis,
  recordModalItems,
  recordModalAddItem,
  recordModalReextract,
  statusFilter,
  recordModalSavedAt,
  recordModalSource,
  recordModalTranscription,
  recordsTableBody,
  exportRecordsButton,
  exportCsvButton,
  searchInput,
  recordsPager,
  medicineLibraryList,
  recordModalNoMedicine,
  recordModalItemsSection,
} from '../shared/dom.js';
import { state } from '../core/state.js';
import { loadRecords, logCsvExport, saveRecord } from '../services/storage.js';
import { downloadVerifiedWorkbook } from '../services/excel-export.js';
import { extractPrescriptionFields } from '../services/extraction.js';
import { MEDICINE_LIBRARY, autoCorrectMedicine, genericOf, suggestMedicine } from '../services/medicine-library.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { openImageViewer } from '../components/image-viewer.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';
import { escapeHtml, showFlashToast, showToast } from '../shared/utils.js';

const PAGE_SIZE = 10;

bindLogoutButton(logoutBtn);
authStatus.textContent = 'Checking session...';
showFlashToast();
medicineLibraryList.innerHTML = MEDICINE_LIBRARY.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');

async function initializeRecordsPage() {
  const currentUser = await requireAuthenticatedUser();
  if (!currentUser) {
    return;
  }

  authStatus.textContent = `Signed in as ${currentUser.email || 'user'}`;

  let recordsLoaded = false;
  try {
    state.records = await loadRecords(currentUser);
    recordsLoaded = true;
  } catch (error) {
    console.error('Unable to load prescriptions:', error);
    authStatus.textContent = `Signed in as ${currentUser.email || 'user'} - records unavailable`;
    recordsTableBody.innerHTML = `
      <tr>
        <td colspan="4">Unable to load records. Check your Supabase table and RLS policies.</td>
      </tr>
    `;
  }

  let currentPage = 1;

  function renderPager(totalRecords, pageCount) {
    recordsPager.hidden = !totalRecords;
    if (!totalRecords) {
      recordsPager.innerHTML = '';
      return;
    }

    const first = (currentPage - 1) * PAGE_SIZE + 1;
    const last = Math.min(currentPage * PAGE_SIZE, totalRecords);
    const pageButtons = Array.from({ length: pageCount }, (_, index) => index + 1)
      .map((page) => `<button class="ghost-btn pager-page${page === currentPage ? ' active' : ''}" type="button" data-page="${page}"${page === currentPage ? ' aria-current="page"' : ''}>${page}</button>`)
      .join('');
    recordsPager.innerHTML = `
      <span class="pager-summary">Showing ${first}-${last} of ${totalRecords}</span>
      ${pageCount > 1 ? `
        <div class="pager-buttons">
          <button class="ghost-btn" type="button" data-page="${currentPage - 1}"${currentPage === 1 ? ' disabled' : ''}>Previous</button>
          ${pageButtons}
          <button class="ghost-btn" type="button" data-page="${currentPage + 1}"${currentPage === pageCount ? ' disabled' : ''}>Next</button>
        </div>` : ''}
    `;
  }

  function renderRecords() {
    if (!recordsLoaded) {
      return;
    }

    const query = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;
    const matchingRecords = state.records.filter((record) => {
      const matchesStatus = filter === 'all' || record.status === filter;
      return matchesStatus && record.source.toLowerCase().includes(query);
    });

    const pageCount = Math.max(1, Math.ceil(matchingRecords.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pageCount);
    renderPager(matchingRecords.length, pageCount);

    if (!matchingRecords.length) {
      recordsTableBody.innerHTML = `
        <tr>
          <td colspan="4">No matching notes found.</td>
        </tr>
      `;
      return;
    }

    const visibleRecords = matchingRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    recordsTableBody.innerHTML = visibleRecords
      .map((record) => {
        return `
          <tr>
            <td>${escapeHtml(record.source || 'Unknown doctor')}</td>
            <td><span class="badge ${record.status === 'Reviewed' ? 'reviewed' : 'pending'}">${escapeHtml(record.status)}</span></td>
            <td>${escapeHtml(record.savedAt)}</td>
            <td>
              <button class="ghost-btn edit-record-btn" data-id="${record.id}" type="button">${record.status === 'Reviewed' ? 'View / edit' : 'Review'}</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function csvValue(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  // Only human-verified records are exported.
  function getVerifiedRecords() {
    const verified = state.records.filter((record) => record.status === 'Reviewed');
    if (!verified.length) {
      showToast('No verified records to export yet.');
    }
    return verified;
  }

  async function exportExcel() {
    const verified = getVerifiedRecords();
    if (!verified.length) {
      return;
    }

    exportRecordsButton.disabled = true;
    try {
      const fileName = `guadahealth-verified-${new Date().toISOString().slice(0, 10)}.xlsx`;
      await downloadVerifiedWorkbook(verified, currentUser.email || 'user', fileName);
      logCsvExport(currentUser, fileName, verified.length);
      showToast(`Exported ${verified.length} verified record${verified.length === 1 ? '' : 's'} to Excel`);
    } catch (error) {
      console.error(error);
      showToast('Unable to create the Excel file. Check your internet connection.');
    } finally {
      exportRecordsButton.disabled = false;
    }
  }

  function exportCsv() {
    const verified = getVerifiedRecords();
    if (!verified.length) {
      return;
    }

    const header = ['Prescription ID', 'Prescribing doctor', 'Verified at', 'Diagnosis', 'Medicine', 'Dosage / instructions', 'Edited by reviewer'];
    const rows = verified.flatMap((record) => {
      // Verified with "No medicine on this prescription" checked.
      const items = record.items.length ? record.items : [{ medicine_name: 'None prescribed', dosage: '', is_edited: false, none: true }];
      return items.map((item) => [
        record.id,
        record.source || 'N/A',
        record.verifiedAt ? new Date(record.verifiedAt).toLocaleString() : '',
        record.diagnosis,
        item.medicine_name,
        item.dosage,
        item.none ? '' : (item.is_edited ? 'Yes' : 'No'),
      ]);
    });
    const csv = [header, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n');
    const fileName = `guadahealth-verified-${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    logCsvExport(currentUser, fileName, verified.length);
    showToast(`Exported ${verified.length} verified record${verified.length === 1 ? '' : 's'}`);
  }

  // Item rows in the modal. Rows remember their original values to compute is_edited.
  function addItemRow(item = { medicine_name: '', dosage: '', confidence_score: null, is_edited: false }, isNew = false) {
    const row = document.createElement('tr');
    row.dataset.originalMedicine = item.medicine_name;
    row.dataset.originalDosage = item.dosage;
    row.dataset.confidence = item.confidence_score ?? '';
    row.dataset.wasEdited = item.is_edited || isNew ? '1' : '';
    row.innerHTML = `
      <td>
        <input class="item-medicine" type="text" list="medicine-library" value="${escapeHtml(item.medicine_name)}" aria-label="Medicine" />
        <div class="medicine-hint" aria-live="polite"></div>
      </td>
      <td><input class="item-dosage" type="text" value="${escapeHtml(item.dosage)}" aria-label="Dosage" /></td>
      <td><button class="ghost-btn remove-item-btn" type="button" aria-label="Remove medicine">Remove</button></td>
    `;
    recordModalItems.append(row);
    updateMedicineHint(row);
  }

  // Under each medicine: what an automatic correction replaced (with Undo), or else "Did you mean ...?"
  // when the name is close to, but not in, the medicine library.
  function updateMedicineHint(row) {
    const hint = row.querySelector('.medicine-hint');
    const name = row.querySelector('.item-medicine').value;
    // Brand names show their generic name: "Brand name of Paracetamol".
    const generic = genericOf(name);
    const genericNote = generic ? ` Brand name of ${escapeHtml(generic)}.` : '';
    hint.classList.toggle('is-corrected', Boolean(row.dataset.autoCorrectedFrom));
    hint.classList.toggle('is-info', !row.dataset.autoCorrectedFrom && Boolean(generic));
    if (row.dataset.autoCorrectedFrom) {
      hint.innerHTML = `Corrected from "${escapeHtml(row.dataset.autoCorrectedFrom)}" using the medicine library.${genericNote} <button class="hint-apply-btn hint-undo-btn" type="button">Undo</button>`;
      return;
    }

    const suggestion = row.dataset.autoCorrectUndone ? '' : suggestMedicine(name);
    if (suggestion) {
      const suggestionGeneric = genericOf(suggestion);
      hint.innerHTML = `Did you mean <button class="hint-apply-btn" type="button" data-suggestion="${escapeHtml(suggestion)}">${escapeHtml(suggestion)}</button>${suggestionGeneric ? ` (${escapeHtml(suggestionGeneric)})` : ''}?`;
      return;
    }
    hint.innerHTML = genericNote.trim();
  }

  // Replaces recognized medicine names that are one or two letters from a single library name.
  // Only names not yet changed by a reviewer are corrected; the reviewer sees each change and can undo it.
  function applyAutoCorrections() {
    let count = 0;
    recordModalItems.querySelectorAll('tr').forEach((row) => {
      if (row.dataset.wasEdited) {
        return;
      }
      const input = row.querySelector('.item-medicine');
      const corrected = autoCorrectMedicine(input.value);
      if (corrected) {
        row.dataset.autoCorrectedFrom = input.value;
        input.value = corrected;
        updateMedicineHint(row);
        count += 1;
      }
    });
    if (count) {
      showToast(`Corrected ${count} medicine name${count === 1 ? '' : 's'} using the medicine library. Check them against the image.`, 4000);
    }
    return count;
  }

  // Values in the editor, compared on save to find out whether anything changed.
  function readModalSnapshot() {
    return JSON.stringify({
      noMedicine: recordModalNoMedicine.checked,
      source: recordModalSource.value.trim(),
      transcription: recordModalTranscription.value.trim(),
      diagnosis: recordModalDiagnosis.value.trim(),
      items: Array.from(recordModalItems.querySelectorAll('tr')).map((row) => [
        row.querySelector('.item-medicine').value.trim(),
        row.querySelector('.item-dosage').value.trim(),
      ]),
    });
  }

  let openedSnapshot = '';

  // "No medicine on this prescription": hides the medicine list, which is then saved empty.
  function setNoMedicine(checked) {
    recordModalNoMedicine.checked = checked;
    recordModalItemsSection.hidden = checked;
  }

  function readItemRows() {
    return Array.from(recordModalItems.querySelectorAll('tr')).map((row) => {
      const medicine = row.querySelector('.item-medicine').value;
      const dosage = row.querySelector('.item-dosage').value;
      const changed = medicine.trim() !== row.dataset.originalMedicine.trim() || dosage.trim() !== row.dataset.originalDosage.trim();
      return {
        medicine_name: medicine,
        dosage,
        confidence_score: row.dataset.confidence === '' ? null : Number(row.dataset.confidence),
        is_edited: Boolean(row.dataset.wasEdited) || changed,
      };
    });
  }

  function openRecordModal(recordId) {
    const record = state.records.find((entry) => entry.id === recordId);
    if (!record) {
      return;
    }

    state.activeRecordId = recordId;
    recordModalSource.value = record.source || 'N/A';
    recordModalSavedAt.textContent = record.savedAt;
    recordModalImage.src = record.imageUrl || '';
    recordModalImage.hidden = !record.imageUrl;
    recordModalImagePlaceholder.hidden = Boolean(record.imageUrl);
    recordModalImage.addEventListener('error', () => {
      recordModalImage.hidden = true;
      recordModalImagePlaceholder.hidden = false;
      recordModalImagePlaceholder.textContent = 'Image could not be loaded. Verify the Storage path and SELECT policy.';
    }, { once: true });
    recordModalTranscription.value = record.transcription || '';
    recordModalDiagnosis.value = record.diagnosis || '';
    recordModalItems.innerHTML = '';
    record.items.forEach((item) => addItemRow(item));
    // A verified record saved without medicines was marked as having none.
    setNoMedicine(record.status === 'Reviewed' && !record.items.length);
    recordModalVerify.textContent = record.status === 'Reviewed' ? 'Save & keep verified' : 'Verify & save';
    // Taken before corrections, so a corrected name counts as a change when saving.
    openedSnapshot = readModalSnapshot();
    recordModal.classList.remove('hidden');
    recordModal.setAttribute('aria-hidden', 'false');
    recordModalTranscription.focus();
    // Verified records keep the names the reviewer approved.
    if (record.status !== 'Reviewed') {
      applyAutoCorrections();
    }
  }

  function closeRecordModal() {
    // Move focus out before hiding, or the modal hides a focused element from assistive tech.
    if (recordModal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    state.activeRecordId = '';
    recordModal.classList.add('hidden');
    recordModal.setAttribute('aria-hidden', 'true');
    recordModalImage.hidden = true;
    recordModalImage.removeAttribute('src');
    recordModalImagePlaceholder.hidden = false;
    recordModalSource.value = '';
    recordModalTranscription.value = '';
    recordModalDiagnosis.value = '';
    recordModalItems.innerHTML = '';
    setNoMedicine(false);
  }

  async function saveActiveRecord(verify) {
    if (!state.activeRecordId) {
      return null;
    }

    const record = state.records.find((entry) => entry.id === state.activeRecordId);
    if (!record) {
      return null;
    }

    // Medicine rows hidden by "No medicine on this prescription" are kept on screen until closing, but not saved.
    const items = recordModalNoMedicine.checked ? [] : readItemRows();
    if (verify && !recordModalNoMedicine.checked && !items.some((item) => item.medicine_name.trim())) {
      throw new Error('Add at least one medicine, or check "No medicine on this prescription", before verifying.');
    }

    const updatedRecord = await saveRecord(currentUser, record.id, {
      transcription: recordModalTranscription.value.trim() || 'No transcription generated yet.',
      source: recordModalSource.value,
      diagnosis: recordModalDiagnosis.value,
      items,
      // Editing an already verified record keeps it verified.
      verify: verify || record.status === 'Reviewed',
    });
    Object.assign(record, updatedRecord);
    renderRecords();
    return record;
  }

  recordsTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('.edit-record-btn');
    if (!button) {
      return;
    }

    openRecordModal(button.dataset.id);
  });

  function viewRecordImage() {
    const record = state.records.find((entry) => entry.id === state.activeRecordId);
    openImageViewer(recordModalImage.src, `Prescription from ${record?.source || 'unknown doctor'}`);
  }

  recordModalImage.addEventListener('click', viewRecordImage);
  recordModalImage.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      viewRecordImage();
    }
  });

  recordModalClose.addEventListener('click', closeRecordModal);
  recordModal.addEventListener('click', (event) => {
    if (event.target.hasAttribute('data-close-modal')) {
      closeRecordModal();
    }
  });

  // Saving with no changes asks first, so a record is not marked verified without being checked.
  async function confirmUnchangedSave(verify) {
    if (readModalSnapshot() !== openedSnapshot) {
      return true;
    }

    const record = state.records.find((entry) => entry.id === state.activeRecordId);
    if (verify && record?.status !== 'Reviewed') {
      return confirmDialog({
        title: 'Verify without changes?',
        message: 'You have not changed anything. Verify only if you checked every medicine, dosage, and the diagnosis against the prescription image.',
        confirmLabel: 'Yes, verify as is',
      });
    }

    return confirmDialog({
      title: 'No changes to save',
      message: 'You have not changed anything in this record. Save it anyway?',
      confirmLabel: 'Save anyway',
    });
  }

  async function handleSave(verify) {
    if (!(await confirmUnchangedSave(verify))) {
      return;
    }

    recordModalSave.disabled = true;
    recordModalVerify.disabled = true;
    try {
      const record = await saveActiveRecord(verify);
      if (!record) {
        closeRecordModal();
        return;
      }

      showToast(verify ? `Verified ${record.source}` : `Saved ${record.source}`);
      closeRecordModal();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Unable to update prescription');
    } finally {
      recordModalSave.disabled = false;
      recordModalVerify.disabled = false;
    }
  }

  recordModalSave.addEventListener('click', () => handleSave(false));
  recordModalVerify.addEventListener('click', () => handleSave(true));
  recordModalAddItem.addEventListener('click', () => addItemRow(undefined, true));
  recordModalNoMedicine.addEventListener('change', () => setNoMedicine(recordModalNoMedicine.checked));
  recordModalItems.addEventListener('click', (event) => {
    const row = event.target.closest('tr');
    if (event.target.closest('.hint-undo-btn')) {
      row.querySelector('.item-medicine').value = row.dataset.autoCorrectedFrom;
      delete row.dataset.autoCorrectedFrom;
      row.dataset.autoCorrectUndone = '1';
      updateMedicineHint(row);
      return;
    }
    const applyButton = event.target.closest('.hint-apply-btn');
    if (applyButton) {
      row.querySelector('.item-medicine').value = applyButton.dataset.suggestion;
      updateMedicineHint(row);
      return;
    }
    event.target.closest('.remove-item-btn')?.closest('tr').remove();
  });
  recordModalItems.addEventListener('input', (event) => {
    if (event.target.classList.contains('item-medicine')) {
      // Typing over a corrected name replaces the correction with what the reviewer wrote.
      const row = event.target.closest('tr');
      delete row.dataset.autoCorrectedFrom;
      updateMedicineHint(row);
    }
  });
  recordModalReextract.addEventListener('click', () => {
    const fields = extractPrescriptionFields(recordModalTranscription.value);
    recordModalItems.innerHTML = '';
    fields.items.forEach((item) => addItemRow(item));
    if (fields.diagnosis && !recordModalDiagnosis.value.trim()) {
      recordModalDiagnosis.value = fields.diagnosis;
    }
    if (!applyAutoCorrections()) {
      showToast(`Extracted ${fields.items.length} medicine${fields.items.length === 1 ? '' : 's'}`);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !recordModal.classList.contains('hidden')) {
      closeRecordModal();
    }
  });

  // Links from the dashboard: ?status=pending filters the list, ?open=<id> opens a record.
  const params = new URLSearchParams(window.location.search);
  if (params.get('status') === 'pending') {
    statusFilter.value = 'Pending review';
  }

  function showFirstPage() {
    currentPage = 1;
    renderRecords();
  }

  searchInput.addEventListener('input', showFirstPage);
  statusFilter.addEventListener('change', showFirstPage);
  recordsPager.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) {
      return;
    }
    currentPage = Number(button.dataset.page);
    renderRecords();
    recordsTableBody.closest('.card').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  exportRecordsButton.addEventListener('click', exportExcel);
  exportCsvButton.addEventListener('click', exportCsv);

  renderRecords();
  if (recordsLoaded && params.get('open')) {
    openRecordModal(params.get('open'));
  }
}

initializeRecordsPage().catch((error) => {
  console.error('Unable to initialize Records:', error);
  authStatus.textContent = 'Records could not be loaded';
  recordsTableBody.innerHTML = `
    <tr>
      <td colspan="4">Records could not be loaded. Check the browser console for the Supabase error.</td>
    </tr>
  `;
});