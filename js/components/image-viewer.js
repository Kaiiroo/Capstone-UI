// Full-screen view of a prescription image. Click the image to switch between fit-to-screen and actual size.
export function openImageViewer(src, alt = 'Prescription image') {
  if (!src) {
    return;
  }

  const previousFocus = document.activeElement;
  const viewer = document.createElement('div');
  viewer.className = 'image-viewer';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', 'Prescription image, full view');
  viewer.innerHTML = `
    <div class="image-viewer-toolbar">
      <span class="image-viewer-hint">Click the image to zoom. Press Esc to close.</span>
      <button class="ghost-btn image-viewer-zoom" type="button">Actual size</button>
      <button class="ghost-btn image-viewer-close" type="button">Close</button>
    </div>
    <div class="image-viewer-stage">
      <img alt="" />
    </div>
  `;
  const image = viewer.querySelector('img');
  image.src = src;
  image.alt = alt;
  const zoomButton = viewer.querySelector('.image-viewer-zoom');

  function setZoomed(zoomed) {
    viewer.classList.toggle('is-zoomed', zoomed);
    zoomButton.textContent = zoomed ? 'Fit to screen' : 'Actual size';
  }

  function close() {
    document.removeEventListener('keydown', onKeydown, true);
    viewer.remove();
    previousFocus?.focus?.();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      // Keep Escape from also closing the record editor underneath.
      event.stopPropagation();
      close();
    }
  }

  image.addEventListener('click', (event) => {
    event.stopPropagation();
    setZoomed(!viewer.classList.contains('is-zoomed'));
  });
  zoomButton.addEventListener('click', () => setZoomed(!viewer.classList.contains('is-zoomed')));
  viewer.querySelector('.image-viewer-close').addEventListener('click', close);
  // Clicking the dark area around the image closes the viewer.
  viewer.querySelector('.image-viewer-stage').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      close();
    }
  });

  document.addEventListener('keydown', onKeydown, true);
  document.body.append(viewer);
  viewer.querySelector('.image-viewer-close').focus();
}
