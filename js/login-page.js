import { VALID_USERS } from './state.js';
import { setCurrentUser, getCurrentUser } from './session.js';
import { showToast } from './utils.js';

const loginForm = document.getElementById('login-form');

if (getCurrentUser()) {
  window.location.replace('dashboard.html');
} else {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showToast('Please enter both fields');
      return;
    }

    if (VALID_USERS[username] && VALID_USERS[username] === password) {
      setCurrentUser(username);
      showToast(`Signed in as ${username}`);
      window.location.href = 'dashboard.html';
      return;
    }

    showToast('Invalid credentials. Try staff / guada2026');
  });
}