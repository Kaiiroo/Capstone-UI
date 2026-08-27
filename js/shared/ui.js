import {
  appShell,
  authScreen,
  clearButton,
  fileInput,
  filePreview,
  filePreviewImage,
  filePreviewPlaceholder,
  navButtons,
  scannerForm,
  saveButton,
  scanButton,
  sourceInput,
  transcriptionOutput,
  views,
} from './dom.js';
import { state } from '../core/state.js';

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function setFormEnabled(enabled) {
  const elements = [fileInput, sourceInput, transcriptionOutput, scanButton, saveButton, clearButton];
  elements.forEach((element) => {
    element.disabled = !enabled;
  });
}

export function resetFilePreview() {
  if (state.filePreviewUrl) {
    URL.revokeObjectURL(state.filePreviewUrl);
    state.filePreviewUrl = '';
  }

  filePreviewImage.hidden = true;
  filePreviewImage.removeAttribute('src');
  filePreviewPlaceholder.hidden = false;
  filePreviewPlaceholder.textContent = 'Image preview will appear here after upload.';
  filePreview.classList.remove('has-image');
}

export function showFilePreview(file) {
  resetFilePreview();

  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    filePreviewPlaceholder.textContent = `Selected file: ${file.name}`;
    return;
  }

  state.filePreviewUrl = URL.createObjectURL(file);
  filePreviewImage.src = state.filePreviewUrl;
  filePreviewImage.hidden = false;
  filePreviewPlaceholder.hidden = true;
  filePreview.classList.add('has-image');
}

export function showAuthView() {
  authScreen.classList.remove('hidden');
  appShell.classList.add('hidden');
}

export function showAppView() {
  authScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
}

export function clearForm() {
  scannerForm.reset();
  transcriptionOutput.value = '';
  resetFilePreview();
}

export function switchView(viewName) {
  if (!state.currentUser) {
    showAuthView();
    return;
  }

  state.activeView = viewName;
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });
  views.forEach((view) => {
    view.classList.toggle('active', view.id === `${viewName}-view`);
  });
}
