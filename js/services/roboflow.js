import { ROBOFLOW_IMAGE_INPUT } from '../config/roboflow.js';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1]));
    reader.addEventListener('error', () => reject(new Error('Unable to read the selected document.')));
    reader.readAsDataURL(file);
  });
}

function findOcrText(value) {
  if (typeof value === 'string' && value.trim()) {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
      try {
        const parsedValue = JSON.parse(trimmedValue);
        return findOcrText(parsedValue);
      } catch {
        // Keep non-JSON text unchanged.
      }
    }

    return trimmedValue;
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const preferredKeys = ['text', 'ocr_text', 'transcription', 'transcript', 'recognized_text'];
  for (const key of preferredKeys) {
    const text = findOcrText(value[key]);
    if (text) {
      return text;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const text = findOcrText(nestedValue);
    if (text) {
      return text;
    }
  }

  return '';
}

export async function runRoboflowOcr(file) {
  const encodingStartedAt = performance.now();
  const image = await fileToBase64(file);
  console.log('Roboflow image prepared:', {
    elapsedMs: Math.round(performance.now() - encodingStartedAt),
    fileSizeBytes: file.size,
    base64SizeBytes: image.length,
  });

  const requestStartedAt = performance.now();
  try {
    const response = await fetch('/api/roboflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: {
          [ROBOFLOW_IMAGE_INPUT]: { type: 'base64', value: image },
        },
      }),
    });

    const responseText = await response.text();
    console.log('Roboflow request:', {
      elapsedMs: Math.round(performance.now() - requestStartedAt),
      status: response.status,
      processingTime: response.headers.get('x-processing-time'),
      coldStart: response.headers.get('x-model-cold-start'),
    });

    let result;
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        response.status === 501
          ? 'The app server does not support transcription requests. Start the app with: python server.py'
          : `Roboflow returned an invalid response (${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(result.error || result.message || `Roboflow request failed (${response.status}).`);
    }

    const text = findOcrText(result);
    if (!text) {
      throw new Error('Roboflow returned no OCR text. Check the workflow output field and input name.');
    }

    return text;
  } catch (error) {
    console.error('Roboflow request failed:', {
      elapsedMs: Math.round(performance.now() - requestStartedAt),
      name: error.name,
      message: error.message,
    });
    throw error;
  }
}
