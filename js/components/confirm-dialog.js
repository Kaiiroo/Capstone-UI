// A small yes/no dialog shown above the record editor. Resolves true when the user confirms.
export function confirmDialog({ title, message, confirmLabel = 'Continue', cancelLabel = 'Go back' }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="modal-backdrop" data-confirm="no"></div>
      <div class="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h3 id="confirm-title"></h3>
        <p id="confirm-message"></p>
        <div class="modal-actions">
          <button class="ghost-btn" type="button" data-confirm="no"></button>
          <button type="button" data-confirm="yes"></button>
        </div>
      </div>
    `;
    dialog.querySelector('#confirm-title').textContent = title;
    dialog.querySelector('#confirm-message').textContent = message;
    dialog.querySelector('button[data-confirm="no"]').textContent = cancelLabel;
    dialog.querySelector('button[data-confirm="yes"]').textContent = confirmLabel;

    function close(result) {
      document.removeEventListener('keydown', onKeydown, true);
      dialog.remove();
      previousFocus?.focus?.();
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        // Keep Escape from also closing the editor underneath.
        event.stopPropagation();
        close(false);
      }
    }

    dialog.addEventListener('click', (event) => {
      const choice = event.target.closest('[data-confirm]')?.dataset.confirm;
      if (choice) {
        close(choice === 'yes');
      }
    });
    document.addEventListener('keydown', onKeydown, true);
    document.body.append(dialog);
    dialog.querySelector('button[data-confirm="yes"]').focus();
  });
}
