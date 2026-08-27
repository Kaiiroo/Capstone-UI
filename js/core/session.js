import { supabase } from '../config/supabase.js';
import { state } from './state.js';

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function clearCurrentUser() {
  state.currentUser = '';
  await supabase.auth.signOut();
}

export async function requireAuthenticatedUser() {
  const currentUser = await getCurrentUser();
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
    await clearCurrentUser();
    window.location.href = 'login.html';
  });
}