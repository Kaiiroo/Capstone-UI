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
    return value.trim();
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
  const image = await fileToBase64(file);
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
}
