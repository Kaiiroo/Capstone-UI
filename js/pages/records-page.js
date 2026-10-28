import {
  authStatus,
  logoutBtn,
  recordModal,
  recordModalCancel,
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
} from '../shared/dom.js';
import { state } from '../core/state.js';
import { loadRecords, logCsvExport, saveRecord } from '../services/storage.js';
import { downloadVerifiedWorkbook } from '../services/excel-export.js';
import { extractPrescriptionFields } from '../services/extraction.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';
import { escapeHtml, showToast } from '../shared/utils.js';

bindLogoutButton(logoutBtn);
authStatus.textContent = 'Checking session...';

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

  function renderRecords() {
    if (!recordsLoaded) {
      return;
    }

    const query = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;
    const visibleRecords = state.records.filter((record) => {
      const matchesStatus = filter === 'all' || record.status === filter;
      return matchesStatus && record.source.toLowerCase().includes(query);
    });

    if (!visibleRecords.length) {
      recordsTableBody.innerHTML = `
        <tr>
          <td colspan="4">No matching notes found.</td>
        </tr>
      `;
      return;
    }

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
      const items = record.items.length ? record.items : [{ medicine_name: '', dosage: '', is_edited: false }];
      return items.map((item) => [
        record.id,
        record.source || 'N/A',
        record.verifiedAt ? new Date(record.verifiedAt).toLocaleString() : '',
        record.diagnosis,
        item.medicine_name,
        item.dosage,
        item.is_edited ? 'Yes' : 'No',
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
      <td><input class="item-medicine" type="text" value="${escapeHtml(item.medicine_name)}" aria-label="Medicine" /></td>
      <td><input class="item-dosage" type="text" value="${escapeHtml(item.dosage)}" aria-label="Dosage" /></td>
      <td><button class="ghost-btn remove-item-btn" type="button" aria-label="Remove medicine">Remove</button></td>
    `;
    recordModalItems.append(row);
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
    recordModalVerify.textContent = record.status === 'Reviewed' ? 'Save & keep verified' : 'Verify & save';
    recordModal.classList.remove('hidden');
    recordModal.setAttribute('aria-hidden', 'false');
    recordModalTranscription.focus();
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
  }

  async function saveActiveRecord(verify) {
    if (!state.activeRecordId) {
      return null;
    }

    const record = state.records.find((entry) => entry.id === state.activeRecordId);
    if (!record) {
      return null;
    }

    const items = readItemRows();
    if (verify && !items.some((item) => item.medicine_name.trim())) {
      throw new Error('Add at least one medicine before verifying.');
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

  recordModalClose.addEventListener('click', closeRecordModal);
  recordModalCancel.addEventListener('click', closeRecordModal);
  recordModal.addEventListener('click', (event) => {
    if (event.target.hasAttribute('data-close-modal')) {
      closeRecordModal();
    }
  });

  async function handleSave(verify) {
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
    }
  }

  recordModalSave.addEventListener('click', () => handleSave(false));
  recordModalVerify.addEventListener('click', () => handleSave(true));
  recordModalAddItem.addEventListener('click', () => addItemRow(undefined, true));
  recordModalItems.addEventListener('click', (event) => {
    event.target.closest('.remove-item-btn')?.closest('tr').remove();
  });
  recordModalReextract.addEventListener('click', () => {
    const fields = extractPrescriptionFields(recordModalTranscription.value);
    recordModalItems.innerHTML = '';
    fields.items.forEach((item) => addItemRow(item));
    if (fields.diagnosis && !recordModalDiagnosis.value.trim()) {
      recordModalDiagnosis.value = fields.diagnosis;
    }
    showToast(`Extracted ${fields.items.length} medicine${fields.items.length === 1 ? '' : 's'}`);
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

  searchInput.addEventListener('input', renderRecords);
  statusFilter.addEventListener('change', renderRecords);
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