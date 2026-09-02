export type ShareViewerTools = {
  facades: boolean;
  dims: boolean;
  xray: boolean;
  freeze: boolean;
  survey: boolean;
  annotate: boolean;
};

export function resolveShareViewerTools(meta: {
  surveyEnabled?: unknown;
  facadesEnabled?: unknown;
  dimsEnabled?: unknown;
  xrayEnabled?: unknown;
  freezeEnabled?: unknown;
  annotateEnabled?: unknown;
}): ShareViewerTools {
  return {
    facades: meta.facadesEnabled !== false,
    dims: meta.dimsEnabled !== false,
    xray: meta.xrayEnabled !== false,
    freeze: meta.freezeEnabled !== false,
    survey: meta.surveyEnabled === true,
    annotate: meta.annotateEnabled !== false,
  };
}
