// Workflow settings. Keep the API key restricted to this app's allowed origins.
export const ROBOFLOW_WORKSPACE = "advinculas-workspace";
export const ROBOFLOW_WORKFLOW = "prescription-handwriting-ocr-1787103424083";
export const ROBOFLOW_IMAGE_INPUT = "image";
export const ROBOFLOW_API_KEY = 'w0hgLHWp9TCdZcFtoxix';


export const isRoboflowConfigured = Boolean(
  ROBOFLOW_WORKSPACE && ROBOFLOW_WORKFLOW && ROBOFLOW_API_KEY,
);
