import { authStatus, logoutBtn, statNotes, statToday, statWeek, welcomeCopy, welcomeTitle } from '../shared/dom.js';
import { loadRecords } from '../services/storage.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';

function animateCount(element, target) {
  const durationMs = 900;
  const startedAt = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = String(Math.round(target * eased));
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

function countSavedSince(records, since) {
  return records.filter((record) => new Date(record.createdAt) >= since).length;
}

const currentUser = await requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser.email || 'user'}`;
  welcomeTitle.textContent = `Welcome back, ${currentUser.email || 'user'}`;
  welcomeCopy.textContent = 'Your saved transcriptions are ready to search, edit, and export from the records archive.';
  bindLogoutButton(logoutBtn);

  try {
    const records = await loadRecords(currentUser);
    animateCount(statNotes, records.length);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    animateCount(statWeek, countSavedSince(records, sevenDaysAgo));
    animateCount(statToday, countSavedSince(records, startOfToday));
  } catch (error) {
    console.error(error);
    document.getElementById('welcome-copy').textContent = 'Unable to load prescriptions. Check your Supabase table and RLS policies.';
  }
}