import { clearCurrentUser, requireAuthenticatedUser } from '../core/session.js';
import { hasAcceptedPrivacy, pageAfterConsent, savePrivacyConsent } from '../core/privacy.js';
import { showToast } from '../shared/utils.js';

// Contact of GuadaHealth's Data Protection Officer, shown in the notice once filled in (e.g. 'dpo@guadahealth.ph').
const DPO_CONTACT = '';

const form = document.getElementById('privacy-form');
const checkbox = document.getElementById('privacy-consent-checkbox');
const acceptButton = document.getElementById('privacy-accept');
const declineButton = document.getElementById('privacy-decline');
const declinedNote = document.getElementById('privacy-declined');

const currentUser = await requireAuthenticatedUser({ requirePrivacyConsent: false });
if (currentUser) {
  if (hasAcceptedPrivacy(currentUser)) {
    window.location.replace(pageAfterConsent());
  }

  document.getElementById('privacy-signed-in').textContent = `Signed in as ${currentUser.email || 'user'}`;
  if (DPO_CONTACT) {
    document.getElementById('privacy-dpo-contact').textContent = `GuadaHealth's Data Protection Officer at ${DPO_CONTACT}`;
  }

  checkbox.addEventListener('change', () => {
    acceptButton.disabled = !checkbox.checked;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!checkbox.checked) {
      return;
    }
    acceptButton.disabled = true;
    acceptButton.textContent = 'Saving...';
    try {
      await savePrivacyConsent();
      window.location.replace(pageAfterConsent());
    } catch (error) {
      console.error('Unable to save privacy consent:', error);
      showToast('Unable to save your agreement. Check your connection and try again.');
      acceptButton.disabled = false;
      acceptButton.textContent = 'I agree, continue';
    }
  });

  declineButton.addEventListener('click', async () => {
    declinedNote.hidden = false;
    declineButton.disabled = true;
    acceptButton.disabled = true;
    try {
      await clearCurrentUser();
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
    window.setTimeout(() => window.location.replace('login.html'), 2500);
  });
}
