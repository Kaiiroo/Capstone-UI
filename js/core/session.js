import { supabase } from '../config/supabase.js';
import { state } from './state.js';

const SESSION_CHECK_TIMEOUT_MS = 8000;
// Lets app pages paint immediately on in-app navigation (see the inline script in each page)
// instead of hiding the shell until the async Supabase check finishes. Purely cosmetic:
// requireAuthenticatedUser still redirects if the session turns out to be invalid.
const AUTH_HINT_KEY = 'gh-authed';

function setAuthHint(isAuthenticated) {
  try {
    if (isAuthenticated) {
      window.sessionStorage.setItem(AUTH_HINT_KEY, '1');
    } else {
      window.sessionStorage.removeItem(AUTH_HINT_KEY);
    }
  } catch {
    // Storage unavailable; pages fall back to waiting for the session check.
  }
}

export async function getCurrentUser() {
  let timeoutId;
  try {
    const sessionRequest = supabase.auth.getSession();
    const timeoutRequest = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error('Supabase session check timed out.'));
      }, SESSION_CHECK_TIMEOUT_MS);
    });
    const { data: { session }, error } = await Promise.race([sessionRequest, timeoutRequest]);
    if (error) {
      throw error;
    }

    return session?.user || null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function clearCurrentUser() {
  state.currentUser = '';
  setAuthHint(false);
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }
}

export async function requireAuthenticatedUser() {
  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch (error) {
    console.error('Unable to restore Supabase session:', error);
    setAuthHint(false);
    window.location.replace('login.html');
    return null;
  }

  if (!currentUser) {
    setAuthHint(false);
    window.location.replace('login.html');
    return null;
  }

  document.body.classList.remove('auth-pending');
  setAuthHint(true);
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      setAuthHint(false);
      window.location.replace('login.html');
    }
  });
  state.currentUser = currentUser.email || currentUser.id;
  return currentUser;
}

export function bindLogoutButton(button) {
  if (!button) {
    return;
  }

  button.addEventListener('click', async () => {
    try {
      await clearCurrentUser();
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
    window.location.href = 'login.html';
  });
}