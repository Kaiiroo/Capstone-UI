import { authStatus, logoutBtn, statNotes, statPending, statReviewed, welcomeCopy, welcomeTitle } from './dom.js';
import { loadRecords } from './storage.js';
import { bindLogoutButton, requireAuthenticatedUser } from './session.js';

const currentUser = requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser}`;
  welcomeTitle.textContent = `Welcome back, ${currentUser}`;
  welcomeCopy.textContent = 'Your transcriptions are ready to review, save, and route into the institution records archive.';
  bindLogoutButton(logoutBtn);

  const records = loadRecords();
  statNotes.textContent = String(records.length);
  statPending.textContent = String(records.filter((record) => record.status === 'Pending review').length);
  statReviewed.textContent = String(records.filter((record) => record.status === 'Reviewed').length);
}