// Workflow settings. The API key is not here: server.py reads ROBOFLOW_API_KEY from .env.
export const ROBOFLOW_WORKSPACE = "advinculas-workspace";
export const ROBOFLOW_WORKFLOW = "prescription-handwriting-ocr-1787103424083";
export const ROBOFLOW_IMAGE_INPUT = "image";


export const isRoboflowConfigured = Boolean(
  ROBOFLOW_WORKSPACE && ROBOFLOW_WORKFLOW,
);
