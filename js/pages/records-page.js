import {
  authStatus,
  logoutBtn,
  recordModal,
  recordModalCancel,
  recordModalClose,
  recordModalSave,
  recordModalSavedAt,
  recordModalSource,
  recordModalStatus,
  recordModalTranscription,
  recordsTableBody,
  searchInput,
  statusFilter,
} from '../shared/dom.js';
import { state } from '../core/state.js';
import { loadRecords, updatePrescription } from '../services/storage.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';
import { escapeHtml, showToast } from '../shared/utils.js';

const currentUser = await requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser}`;
  bindLogoutButton(logoutBtn);

  state.records = await loadRecords(currentUser);

  function renderRecords() {
    const query = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;
    const visibleRecords = state.records.filter((record) => {
      const matchesText = [record.source, record.status].join(' ').toLowerCase().includes(query);
      const matchesStatus = filter === 'all' || record.status === filter;
      return matchesText && matchesStatus;
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
        const badgeClass = record.status === 'Reviewed' ? 'reviewed' : 'pending';
        return `
          <tr>
            <td>${escapeHtml(record.source || 'Untitled note')}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(record.status)}</span></td>
            <td>${escapeHtml(record.savedAt)}</td>
            <td>
              <button class="ghost-btn edit-record-btn" data-id="${record.id}" type="button">Edit note</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function openRecordModal(recordId) {
    const record = state.records.find((entry) => entry.id === recordId);
    if (!record) {
      return;
    }

    state.activeRecordId = recordId;
    recordModalSource.textContent = record.source || 'Untitled note';
    recordModalStatus.textContent = record.status;
    recordModalSavedAt.textContent = record.savedAt;
    recordModalTranscription.value = record.transcription || '';
    recordModal.classList.remove('hidden');
    recordModal.setAttribute('aria-hidden', 'false');
    recordModalTranscription.focus();
  }

  function closeRecordModal() {
    state.activeRecordId = '';
    recordModal.classList.add('hidden');
    recordModal.setAttribute('aria-hidden', 'true');
    recordModalTranscription.value = '';
  }

  async function saveActiveRecordTranscription(transcriptionValue) {
    if (!state.activeRecordId) {
      return null;
    }

    const record = state.records.find((entry) => entry.id === state.activeRecordId);
    if (!record) {
      return null;
    }

    record.transcription = transcriptionValue.trim() || 'No transcription generated yet.';
    const updatedRecord = await updatePrescription(record.id, record.transcription);
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

  recordModalSave.addEventListener('click', async () => {
    try {
      const record = await saveActiveRecordTranscription(recordModalTranscription.value);
      if (!record) {
        closeRecordModal();
        return;
      }

      showToast(`Updated ${record.source}`);
      closeRecordModal();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Unable to update prescription');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !recordModal.classList.contains('hidden')) {
      closeRecordModal();
    }
  });

  searchInput.addEventListener('input', renderRecords);
  statusFilter.addEventListener('change', renderRecords);

  renderRecords();
}