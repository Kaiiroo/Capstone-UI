export function showToast(message, duration = 2200) {
  const toast = document.getElementById('toast');
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// A toast for the next page, for actions that navigate away right after they finish.
const FLASH_KEY = 'gh-flash';

export function setFlashToast(message) {
  try {
    window.sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    // Storage blocked: the message is skipped, the action itself already succeeded.
  }
}

export function showFlashToast() {
  try {
    const message = window.sessionStorage.getItem(FLASH_KEY);
    if (message) {
      window.sessionStorage.removeItem(FLASH_KEY);
      showToast(message, 4000);
    }
  } catch {
    // Storage blocked: nothing to show.
  }
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
