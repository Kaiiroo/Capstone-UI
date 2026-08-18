const authScreen = document.getElementById('auth-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const scannerForm = document.getElementById('scanner-form');
const authStatus = document.getElementById('auth-status');
const fileInput = document.getElementById('file-input');
const sourceInput = document.getElementById('source-input');
const transcriptionOutput = document.getElementById('transcription-output');
const scanButton = document.getElementById('scan-button');
const saveButton = document.getElementById('save-button');
const clearButton = document.getElementById('clear-button');
const recordsTableBody = document.getElementById('records-table-body');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const welcomeTitle = document.getElementById('welcome-title');
const welcomeCopy = document.getElementById('welcome-copy');
const statNotes = document.getElementById('stat-notes');
const statPending = document.getElementById('stat-pending');
const statReviewed = document.getElementById('stat-reviewed');
const toast = document.getElementById('toast');
const logoutBtn = document.getElementById('logout-btn');
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const views = Array.from(document.querySelectorAll('.view'));

const VALID_USERS = {
  staff: 'guada2026',
  admin: 'health2026',
};
const RECORDS_KEY = 'guadahealth-records';
const AUTH_KEY = 'guadahealth-auth';

let currentUser = '';
let records = [];
let activeView = 'dashboard';

function loadRecords() {
  const saved = localStorage.getItem(RECORDS_KEY);
  if (saved) {
    return JSON.parse(saved);
  }

  return [
    {
      id: 'seed-1',
      source: 'Cardiology consult',
      transcription: 'Patient reported persistent fatigue. Medication reviewed and updated for follow-up.',
      status: 'Pending review',
      savedAt: '2026-08-10 09:15',
      owner: 'staff',
    },
    {
      id: 'seed-2',
      source: 'Neurology referral',
      transcription: 'Referral completed. Patient scheduled for outpatient review next week.',
      status: 'Reviewed',
      savedAt: '2026-08-10 11:05',
      owner: 'admin',
    },
  ];
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setFormEnabled(enabled) {
  const elements = [fileInput, sourceInput, transcriptionOutput, scanButton, saveButton, clearButton];
  elements.forEach((element) => {
    element.disabled = !enabled;
  });
}

function showAuthView() {
  authScreen.classList.remove('hidden');
  appShell.classList.add('hidden');
}

function showAppView() {
  authScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
}

function setAuthenticated(username) {
  currentUser = username;
  localStorage.setItem(AUTH_KEY, username);
  authStatus.textContent = `Signed in as ${username}`;
  welcomeTitle.textContent = `Welcome back, ${username}`;
  welcomeCopy.textContent = 'Your transcriptions are ready to review, save, and route into the institution records archive.';
  setFormEnabled(true);
  showAppView();
  showToast(`Signed in as ${username}`);
}

function setLoggedOut() {
  currentUser = '';
  localStorage.removeItem(AUTH_KEY);
  authStatus.textContent = 'Not signed in';
  welcomeTitle.textContent = 'Welcome to the transcription workspace';
  welcomeCopy.textContent = 'Sign in to upload doctor notes, review plain-text transcriptions, and save them into the institutional archive.';
  setFormEnabled(false);
  showAuthView();
}

function renderDashboardStats() {
  statNotes.textContent = String(records.length);
  statPending.textContent = String(records.filter((record) => record.status === 'Pending review').length);
  statReviewed.textContent = String(records.filter((record) => record.status === 'Reviewed').length);
}

function renderRecords() {
  const query = searchInput.value.trim().toLowerCase();
  const filter = statusFilter.value;
  const visibleRecords = records.filter((record) => {
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
            <button class="ghost-btn review-btn" data-id="${record.id}" type="button">${record.status === 'Reviewed' ? 'Re-open' : 'Mark reviewed'}</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function switchView(viewName) {
  if (!currentUser) {
    showAuthView();
    return;
  }

  activeView = viewName;
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });
  views.forEach((view) => {
    view.classList.toggle('active', view.id === `${viewName}-view`);
  });
}

function clearForm() {
  scannerForm.reset();
  transcriptionOutput.value = '';
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
  if (!currentUser) {
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

scannerForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!currentUser) {
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
    owner: currentUser,
  };

  records.unshift(record);
  saveRecords();
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
  const button = event.target.closest('.review-btn');
  if (!button) {
    return;
  }

  const noteId = button.dataset.id;
  const note = records.find((entry) => entry.id === noteId);
  if (!note) {
    return;
  }

  note.status = note.status === 'Reviewed' ? 'Pending review' : 'Reviewed';
  saveRecords();
  renderDashboardStats();
  renderRecords();
  showToast(`Updated ${note.source}`);
});

searchInput.addEventListener('input', renderRecords);
statusFilter.addEventListener('change', renderRecords);

window.addEventListener('DOMContentLoaded', () => {
  records = loadRecords();
  renderDashboardStats();
  renderRecords();
  setLoggedOut();
});
