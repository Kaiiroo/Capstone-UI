import { authStatus, logoutBtn, needsReviewList, statPending, statToday, statVerified, welcomeCopy, welcomeTitle } from '../shared/dom.js';
import { loadDashboardSummary } from '../services/storage.js';
import { escapeHtml } from '../shared/utils.js';
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

function renderNeedsReview(records) {
  if (!records.length) {
    needsReviewList.innerHTML = '<li class="review-list-empty">Nothing waiting. All prescriptions are verified.</li>';
    return;
  }

  needsReviewList.innerHTML = records
    .map((record) => `
      <li>
        <a href="records.html?open=${encodeURIComponent(record.id)}">
          <strong>${escapeHtml(record.source)}</strong>
          <span>${escapeHtml(record.savedAt)}</span>
        </a>
      </li>
    `)
    .join('');
}

const currentUser = await requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser.email || 'user'}`;
  welcomeTitle.textContent = `Welcome back, ${currentUser.email || 'user'}`;
  welcomeCopy.textContent = 'Review pending prescriptions, verify their fields, and export verified records.';
  bindLogoutButton(logoutBtn);

  try {
    const summary = await loadDashboardSummary();
    animateCount(statPending, summary.pendingCount);
    animateCount(statVerified, summary.verifiedCount);
    animateCount(statToday, summary.todayCount);
    renderNeedsReview(summary.oldestPending);
  } catch (error) {
    console.error(error);
    welcomeCopy.textContent = 'Unable to load prescriptions. Check your Supabase table and RLS policies.';
    needsReviewList.innerHTML = '<li class="review-list-empty">Unable to load prescriptions.</li>';
  }
}