import {
  recordModal,
  recordModalSavedAt,
  recordModalSource,
  recordModalStatus,
  recordModalTranscription,
  recordModalTitle,
  recordsTableBody,
  searchInput,
  statNotes,
  statPending,
  statReviewed,
  statusFilter,
} from '../shared/dom.js';
import { state } from '../core/state.js';
import { updatePrescription } from '../services/storage.js';
import { escapeHtml } from '../shared/ui.js';

export function renderDashboardStats() {
  statNotes.textContent = String(state.records.length);
  statPending.textContent = String(state.records.filter((record) => record.status === 'Pending review').length);
  statReviewed.textContent = String(state.records.filter((record) => record.status === 'Reviewed').length);
}

export function renderRecords() {
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

export function openRecordModal(recordId) {
  const record = state.records.find((entry) => entry.id === recordId);
  if (!record) {
    return;
  }

  state.activeRecordId = recordId;
  recordModalTitle.textContent = 'Edit transcription';
  recordModalSource.textContent = record.source || 'Untitled note';
  recordModalStatus.textContent = record.status;
  recordModalSavedAt.textContent = record.savedAt;
  recordModalTranscription.value = record.transcription || '';
  recordModal.classList.remove('hidden');
  recordModal.setAttribute('aria-hidden', 'false');
  recordModalTranscription.focus();
}

export function closeRecordModal() {
  state.activeRecordId = '';
  recordModal.classList.add('hidden');
  recordModal.setAttribute('aria-hidden', 'true');
  recordModalTranscription.value = '';
}

export function saveActiveRecordTranscription(transcriptionValue) {
  if (!state.activeRecordId) {
    return null;
  }

  const record = state.records.find((entry) => entry.id === state.activeRecordId);
  if (!record) {
    return null;
  }

  record.transcription = transcriptionValue.trim() || 'No transcription generated yet.';
  updatePrescription(record.id, record.transcription);
  renderRecords();
  return record;
}
