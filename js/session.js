import { AUTH_KEY, state } from './state.js';

export function getCurrentUser() {
  return localStorage.getItem(AUTH_KEY) || '';
}

export function setCurrentUser(username) {
  state.currentUser = username;
  localStorage.setItem(AUTH_KEY, username);
}

export function clearCurrentUser() {
  state.currentUser = '';
  localStorage.removeItem(AUTH_KEY);
}

export function requireAuthenticatedUser() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.replace('login.html');
    return '';
  }

  state.currentUser = currentUser;
  return currentUser;
}

export function bindLogoutButton(button) {
  if (!button) {
    return;
  }

  button.addEventListener('click', () => {
    clearCurrentUser();
    window.location.href = 'login.html';
  });
}