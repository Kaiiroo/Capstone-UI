import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { showToast } from '../shared/utils.js';

const loginForm = document.getElementById('login-form');

async function initializeLogin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.replace('dashboard.html');
    return;
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();

    if (!isSupabaseConfigured) {
      showToast('Add your Supabase URL and anon key in js/supabase.js');
      return;
    }

    if (!email || !password) {
      showToast('Please enter both fields');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      showToast(`Signed in as ${email}`);
      window.location.href = 'dashboard.html';
      return;
    }

    showToast(error.message || 'Unable to sign in');
  });
}

initializeLogin();