import { clearButton, fileInput, filePreview, filePreviewImage, filePreviewPlaceholder, logoutBtn, saveButton, scanButton, scannerForm, sourceInput, transcriptionOutput, transcriptionProgress, authStatus } from '../shared/dom.js';
import { createTranscriptionProgress } from '../components/transcription-progress.js';
import { createPrescription } from '../services/storage.js';
import { extractPrescriptionFields } from '../services/extraction.js';
import { runRoboflowOcr } from '../services/roboflow.js';
import { bindLogoutButton, requireAuthenticatedUser } from '../core/session.js';
import { setFlashToast, showToast } from '../shared/utils.js';

const currentUser = await requireAuthenticatedUser();
if (currentUser) {
  authStatus.textContent = `Signed in as ${currentUser.email || 'user'}`;
  bindLogoutButton(logoutBtn);

  let filePreviewUrl = '';
  const progress = createTranscriptionProgress(transcriptionProgress);

  function resetFilePreview() {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      filePreviewUrl = '';
    }

    filePreviewImage.hidden = true;
    filePreviewImage.style.display = 'none';
    filePreviewImage.removeAttribute('src');
    filePreviewPlaceholder.hidden = false;
    filePreviewPlaceholder.style.display = 'block';
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
    filePreviewImage.style.display = 'block';
    filePreviewPlaceholder.hidden = true;
    filePreviewPlaceholder.style.display = 'none';
    filePreview.classList.add('has-image');
  }

  filePreviewImage.addEventListener('error', () => {
    resetFilePreview();
    filePreviewPlaceholder.textContent = `Unable to preview ${fileInput.files[0]?.name || 'this image'}.`;
  });

  function clearForm() {
    scannerForm.reset();
    transcriptionOutput.value = '';
    resetFilePreview();
  }

  let isTranscribing = false;

  // Locks the upload, save, and clear controls while the OCR reads the image.
  function setTranscribing(active) {
    isTranscribing = active;
    scanButton.disabled = active;
    scanButton.textContent = active ? 'Transcribing...' : 'Generate transcription preview';
    fileInput.disabled = active;
    saveButton.disabled = active;
    clearButton.disabled = active;
    fileInput.title = active ? 'Wait for the transcription to finish before choosing another file.' : '';
  }

  scanButton.addEventListener('click', async () => {
    const selectedFile = fileInput.files[0];
    if (!selectedFile) {
      showToast('Choose a document first to generate a preview.');
      transcriptionOutput.value = 'Choose a document first to generate a preview.';
      return;
    }

    // The image being read must not change until the OCR finishes.
    setTranscribing(true);
    progress.start();
    try {
      transcriptionOutput.value = await runRoboflowOcr(selectedFile, progress.update);
      progress.complete();
      transcriptionOutput.classList.remove('just-filled');
      void transcriptionOutput.offsetWidth;
      transcriptionOutput.classList.add('just-filled');
      showToast('Transcription generated');
    } catch (error) {
      console.error(error);
      progress.fail(error.message || 'Transcription failed');
      transcriptionOutput.value = error.message || 'Unable to generate transcription.';
      showToast('Transcription failed');
    } finally {
      setTranscribing(false);
    }
  });

  fileInput.addEventListener('change', () => {
    showFilePreview(fileInput.files[0]);
  });

  scannerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    // Enter in a text field also submits the form; saving waits for the transcription.
    if (isTranscribing) {
      showToast('Wait for the transcription to finish before saving.');
      return;
    }

    const selectedFile = fileInput.files[0];
    if (!selectedFile) {
      transcriptionOutput.value = 'No document selected. Upload one before saving.';
      return;
    }

    const source = sourceInput.value.trim() || 'N/A';
    const saveLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    showToast('Uploading prescription...', 60000);
    try {
      const transcription = transcriptionOutput.value || 'No transcription generated yet.';
      await createPrescription(currentUser, selectedFile, transcription, source, extractPrescriptionFields(transcription));
      // The Records page shows this after the redirect; it is pending until a staff member verifies it.
      setFlashToast(`Prescription from ${source} saved. It is waiting for review.`);
      clearForm();
      window.location.href = 'records.html';
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Unable to save prescription');
      saveButton.disabled = false;
      saveButton.textContent = saveLabel;
    }
  });

  clearButton.addEventListener('click', () => {
    clearForm();
    showToast('Form cleared');
  });
}