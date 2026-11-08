// Finds the recognized text inside a Roboflow workflow response.
// Shared by the website (roboflow.js) and the evaluation script (evaluation/evaluate.mjs).

// The workflow writes circled list numbers as LaTeX ("$\textcircled{1}$") and blank form fields as "___".
export function cleanOcrText(text) {
  return text
    .replace(/\$\s*\\textcircled\{\s*([^}]*?)\s*\}\s*\$/g, '($1)')
    .replace(/[ \t]*_{3,}[ \t]*/g, ' ')
    .replace(/[ \t]+$/gm, '');
}

export function findOcrText(value) {
  if (typeof value === 'string' && value.trim()) {
    // Some workflow outputs wrap their answer in a markdown code fence.
    const trimmedValue = value.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
      try {
        const parsedValue = JSON.parse(trimmedValue);
        return findOcrText(parsedValue);
      } catch {
        // Keep non-JSON text unchanged.
      }
    }

    return cleanOcrText(trimmedValue);
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
