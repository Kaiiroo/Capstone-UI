import { clearButton, fileInput, filePreview, filePreviewImage, filePreviewPlaceholder, logoutBtn, scanButton, scannerForm, sourceInput, transcriptionOutput, authStatus } from '../shared/dom.js';
import { createPrescription } from '../services/storage.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';
import { showToast } from '../shared/utils.js';

const currentUser = await requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser}`;
  bindLogoutButton(logoutBtn);

  let filePreviewUrl = '';

  function resetFilePreview() {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      filePreviewUrl = '';
    }

    filePreviewImage.hidden = true;
    filePreviewImage.removeAttribute('src');
    filePreviewPlaceholder.hidden = false;
    filePreviewPlaceholder.textContent = 'Image preview will appear here after upload.';
    filePreview.classList.remove('has-image');
  }

  function showFilePreview(file) {
    resetFilePreview();

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      filePreviewPlaceholder.textContent = `Selected file: ${file.name}`;
      return;
    }

    filePreviewUrl = URL.createObjectURL(file);
    filePreviewImage.src = filePreviewUrl;
    filePreviewImage.hidden = false;
    filePreviewPlaceholder.hidden = true;
    filePreview.classList.add('has-image');
  }

  function clearForm() {
    scannerForm.reset();
    transcriptionOutput.value = '';
    resetFilePreview();
  }

  scanButton.addEventListener('click', () => {
    const selectedFile = fileInput.files[0];
    if (!selectedFile) {
      showToast('Choose a document first to generate a preview.');
      transcriptionOutput.value = 'Choose a document first to generate a preview.';
      return;
    }

    const source = sourceInput.value.trim() || selectedFile.name;
    transcriptionOutput.value = `Transcription preview for ${source}\n\nReadable note:\nThe clinical summary has been standardized into plain language. Symptoms, medications, and follow-up instructions are now easier for staff to read and act on.`;
    showToast('Preview generated');
  });

  fileInput.addEventListener('change', () => {
    showFilePreview(fileInput.files[0]);
  });

  scannerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const selectedFile = fileInput.files[0];
    if (!selectedFile) {
      transcriptionOutput.value = 'No document selected. Upload one before saving.';
      return;
    }

    const source = sourceInput.value.trim() || selectedFile.name;
    try {
      await createPrescription(currentUser, selectedFile, transcriptionOutput.value || 'No transcription generated yet.');
      showToast(`Saved note for ${source}`);
      clearForm();
      window.location.href = 'records.html';
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Unable to save prescription');
    }
  });

  clearButton.addEventListener('click', () => {
    clearForm();
    showToast('Form cleared');
  });
}