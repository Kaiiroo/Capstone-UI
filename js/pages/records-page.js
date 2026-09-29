import {
  authStatus,
  logoutBtn,
  recordModal,
  recordModalCancel,
  recordModalClose,
  recordModalImage,
  recordModalImagePlaceholder,
  recordModalSave,
  recordModalSavedAt,
  recordModalSource,
  recordModalTranscription,
  recordsTableBody,
  searchInput,
} from '../shared/dom.js';
import { state } from '../core/state.js';
import { loadRecords, updatePrescription } from '../services/storage.js';
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
        <td colspan="3">Unable to load records. Check your Supabase table and RLS policies.</td>
      </tr>
    `;
  }

  function renderRecords() {
    if (!recordsLoaded) {
      return;
    }

    const query = searchInput.value.trim().toLowerCase();
    const visibleRecords = state.records.filter((record) => {
      return record.source.toLowerCase().includes(query);
    });

    if (!visibleRecords.length) {
      recordsTableBody.innerHTML = `
        <tr>
          <td colspan="3">No matching notes found.</td>
        </tr>
      `;
      return;
    }

    recordsTableBody.innerHTML = visibleRecords
      .map((record) => {
        return `
          <tr>
            <td>${escapeHtml(record.source || 'Untitled note')}</td>
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
    recordModal.classList.remove('hidden');
    recordModal.setAttribute('aria-hidden', 'false');
    recordModalTranscription.focus();
  }

  function closeRecordModal() {
    state.activeRecordId = '';
    recordModal.classList.add('hidden');
    recordModal.setAttribute('aria-hidden', 'true');
    recordModalImage.hidden = true;
    recordModalImage.removeAttribute('src');
    recordModalImagePlaceholder.hidden = false;
    recordModalSource.value = '';
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
    const updatedRecord = await updatePrescription(record.id, record.transcription, recordModalSource.value);
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

  renderRecords();
}

initializeRecordsPage().catch((error) => {
  console.error('Unable to initialize Records:', error);
  authStatus.textContent = 'Records could not be loaded';
  recordsTableBody.innerHTML = `
    <tr>
      <td colspan="3">Records could not be loaded. Check the browser console for the Supabase error.</td>
    </tr>
  `;
});