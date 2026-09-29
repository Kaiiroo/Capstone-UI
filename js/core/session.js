import { supabase } from '../config/supabase.js';
import { state } from './state.js';

const SESSION_CHECK_TIMEOUT_MS = 8000;

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
    window.location.replace('login.html');
    return null;
  }

  if (!currentUser) {
    window.location.replace('login.html');
    return null;
  }

  document.body.classList.remove('auth-pending');
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
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