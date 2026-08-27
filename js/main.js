import {
  authStatus,
  clearButton,
  fileInput,
  loginForm,
  logoutBtn,
  navButtons,
  recordModal,
  recordModalCancel,
  recordModalClose,
  recordModalSave,
  recordModalTranscription,
  scannerForm,
  scanButton,
  searchInput,
  sourceInput,
  statusFilter,
  transcriptionOutput,
  welcomeCopy,
  welcomeTitle,
} from './dom.js';
import { AUTH_KEY, VALID_USERS, state } from './state.js';
import { loadRecords, saveRecords } from './storage.js';
import {
  clearForm,
  setFormEnabled,
  showAppView,
  showAuthView,
  showFilePreview,
  showToast,
  switchView,
} from './ui.js';
import {
  closeRecordModal,
  openRecordModal,
  renderDashboardStats,
  renderRecords,
  saveActiveRecordTranscription,
} from './records.js';

function setAuthenticated(username) {
  state.currentUser = username;
  localStorage.setItem(AUTH_KEY, username);
  authStatus.textContent = `Signed in as ${username}`;
  welcomeTitle.textContent = `Welcome back, ${username}`;
  welcomeCopy.textContent = 'Your transcriptions are ready to review, save, and route into the institution records archive.';
  setFormEnabled(true);
  showAppView();
  showToast(`Signed in as ${username}`);
}

function setLoggedOut() {
  state.currentUser = '';
  localStorage.removeItem(AUTH_KEY);
  authStatus.textContent = 'Not signed in';
  welcomeTitle.textContent = 'Welcome to the transcription workspace';
  welcomeCopy.textContent = 'Sign in to upload doctor notes, review plain-text transcriptions, and save them into the institutional archive.';
  setFormEnabled(false);
  showAuthView();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value.trim();

  if (!username || !password) {
    showToast('Please enter both fields');
    return;
  }

  if (VALID_USERS[username] && VALID_USERS[username] === password) {
    setAuthenticated(username);
    loginForm.reset();
    switchView('transcribe');
  } else {
    showToast('Invalid credentials. Try staff / guada2026');
  }
});

scanButton.addEventListener('click', () => {
  if (!state.currentUser) {
    showToast('Please log in first');
    return;
  }

  const selectedFile = fileInput.files[0];
  if (!selectedFile) {
    transcriptionOutput.value = 'Choose a document first to generate a preview.';
    return;
  }

  const source = sourceInput.value.trim() || selectedFile.name;

  transcriptionOutput.value = `Transcription preview for ${source}\n\nReadable note:\nThe clinical summary has been standardized into plain language. Symptoms, medications, and follow-up instructions are now easier for staff to read and act on.`;
  showToast('Preview generated');
});

fileInput.addEventListener('change', () => {
  showFilePreview(fileInput.files[0]);
});

scannerForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!state.currentUser) {
    showToast('Please log in first');
    return;
  }

  if (!fileInput.files[0]) {
    transcriptionOutput.value = 'No document selected. Upload one before saving.';
    return;
  }

  const source = sourceInput.value.trim() || fileInput.files[0].name;
  const record = {
    id: `note-${Date.now()}`,
    source,
    transcription: transcriptionOutput.value || 'No transcription generated yet.',
    status: 'Pending review',
    savedAt: new Date().toLocaleString(),
    owner: state.currentUser,
  };

  state.records.unshift(record);
  saveRecords(state.records);
  renderDashboardStats();
  renderRecords();
  showToast(`Saved note for ${source}`);
  clearForm();
  switchView('records');
});

clearButton.addEventListener('click', () => {
  clearForm();
  showToast('Form cleared');
});

navButtons.forEach((button) => {
  button.addEventListener('click', () => switchView(button.dataset.view));
});

logoutBtn.addEventListener('click', () => {
  setLoggedOut();
  switchView('dashboard');
  showToast('Signed out');
});

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

recordModalSave.addEventListener('click', () => {
  const record = saveActiveRecordTranscription(recordModalTranscription.value);
  if (!record) {
    closeRecordModal();
    return;
  }

  showToast(`Updated ${record.source}`);
  closeRecordModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !recordModal.classList.contains('hidden')) {
    closeRecordModal();
  }
});

searchInput.addEventListener('input', renderRecords);
statusFilter.addEventListener('change', renderRecords);

window.addEventListener('DOMContentLoaded', () => {
  state.records = loadRecords();
  renderDashboardStats();
  renderRecords();
  setLoggedOut();
});
