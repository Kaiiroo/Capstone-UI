// Data Privacy Act of 2012 consent, saved on each user's account so every staff member agrees for themselves,
// on any device. Raising CONSENT_VERSION (after changing the notice) asks everyone to agree again.
import { supabase } from '../config/supabase.js';

export const CONSENT_VERSION = 3;
export const PRIVACY_PAGE = 'privacy.html';

export function hasAcceptedPrivacy(user) {
  return user?.user_metadata?.privacy_consent?.version === CONSENT_VERSION;
}

// Saves the agreement in the user's Supabase account (user_metadata.privacy_consent), with the date and time.
export async function savePrivacyConsent() {
  const { error } = await supabase.auth.updateUser({
    data: { privacy_consent: { version: CONSENT_VERSION, accepted_at: new Date().toISOString() } },
  });
  if (error) {
    throw error;
  }
}

// The page to return to after agreeing; only pages of this site are allowed.
export function pageAfterConsent() {
  const next = new URLSearchParams(window.location.search).get('next') || '';
  return /^[a-z-]+\.html(\?[\w=&%.-]*)?$/i.test(next) && !next.startsWith(PRIVACY_PAGE) ? next : 'dashboard.html';
}
