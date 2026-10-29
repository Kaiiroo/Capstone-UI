import { ROBOFLOW_IMAGE_INPUT } from '../config/roboflow.js';
import { supabase } from '../config/supabase.js';

function fileToBase64(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });
    reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1]));
    reader.addEventListener('error', () => reject(new Error('Unable to read the selected document.')));
    reader.readAsDataURL(file);
  });
}

// XHR instead of fetch: fetch can't report upload or download progress.
function postJsonWithProgress(url, body, accessToken, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress({ stage: 'upload', fraction: event.loaded / event.total });
      }
    });
    // Request fully sent: the server is now running the OCR workflow.
    xhr.upload.addEventListener('load', () => onProgress({ stage: 'analyze', fraction: null }));
    xhr.addEventListener('readystatechange', () => {
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        onProgress({ stage: 'finalize', fraction: 0 });
      }
    });
    xhr.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress({ stage: 'finalize', fraction: event.loaded / event.total });
      }
    });
    xhr.addEventListener('load', () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: xhr.responseText,
        header: (name) => xhr.getResponseHeader(name),
      });
    });
    xhr.addEventListener('error', () => reject(new TypeError('Unable to reach the transcription server.')));
    xhr.addEventListener('abort', () => reject(new Error('Transcription request was cancelled.')));
    xhr.send(body);
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

export async function runRoboflowOcr(file, onProgress = () => {}) {
  const encodingStartedAt = performance.now();
  onProgress({ stage: 'read', fraction: 0 });
  const image = await fileToBase64(file, (fraction) => onProgress({ stage: 'read', fraction }));
  onProgress({ stage: 'upload', fraction: 0 });
  console.log('Roboflow image prepared:', {
    elapsedMs: Math.round(performance.now() - encodingStartedAt),
    fileSizeBytes: file.size,
    base64SizeBytes: image.length,
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const requestStartedAt = performance.now();
  try {
    const response = await postJsonWithProgress(
      '/api/roboflow',
      JSON.stringify({
        inputs: {
          [ROBOFLOW_IMAGE_INPUT]: { type: 'base64', value: image },
        },
      }),
      sessionData.session?.access_token,
      onProgress,
    );

    const responseText = response.text;
    console.log('Roboflow request:', {
      elapsedMs: Math.round(performance.now() - requestStartedAt),
      status: response.status,
      processingTime: response.header('x-processing-time'),
      coldStart: response.header('x-model-cold-start'),
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
