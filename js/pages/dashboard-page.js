import { authStatus, logoutBtn, statNotes, statPending, statReviewed, welcomeCopy, welcomeTitle } from '../shared/dom.js';
import { loadRecords } from '../services/storage.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';

const currentUser = await requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser.email || 'user'}`;
  welcomeTitle.textContent = `Welcome back, ${currentUser.email || 'user'}`;
  welcomeCopy.textContent = 'Your transcriptions are ready to review, save, and route into the institution records archive.';
  bindLogoutButton(logoutBtn);

  try {
    const records = await loadRecords(currentUser);
    statNotes.textContent = String(records.length);
    statPending.textContent = String(records.filter((record) => record.status === 'Pending review').length);
    statReviewed.textContent = String(records.filter((record) => record.status === 'Reviewed').length);
  } catch (error) {
    console.error(error);
    document.getElementById('welcome-copy').textContent = 'Unable to load prescriptions. Check your Supabase table and RLS policies.';
  }
}