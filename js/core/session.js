import { supabase } from '../config/supabase.js';
import { state } from './state.js';

export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return session?.user || null;
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