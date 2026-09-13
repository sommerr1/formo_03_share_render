export const DEFAULT_SHARE_BG_COLOR = "#1a1d24";

export function resolveShareBgColor(meta: { bgColor?: unknown }): string {
  if (typeof meta.bgColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(meta.bgColor)) {
    return meta.bgColor;
  }
  return DEFAULT_SHARE_BG_COLOR;
}

export type ShareViewerTools = {
  facades: boolean;
  dims: boolean;
  xray: boolean;
  freeze: boolean;
  overflow: boolean;
  glbAr: boolean;
  bgPhoto: boolean;
  sat: boolean;
  fillersToggle: boolean;
  survey: boolean;
  annotate: boolean;
};

export function resolveShareViewerTools(meta: {
  surveyEnabled?: unknown;
  facadesEnabled?: unknown;
  dimsEnabled?: unknown;
  xrayEnabled?: unknown;
  freezeEnabled?: unknown;
  overflowEnabled?: unknown;
  glbArEnabled?: unknown;
  bgPhotoEnabled?: unknown;
  satEnabled?: unknown;
  fillersToggleEnabled?: unknown;
  annotateEnabled?: unknown;
}): ShareViewerTools {
  return {
    facades: meta.facadesEnabled !== false,
    dims: meta.dimsEnabled !== false,
    xray: meta.xrayEnabled !== false,
    freeze: meta.freezeEnabled !== false,
    overflow: meta.overflowEnabled !== false,
    glbAr: meta.glbArEnabled !== false,
    bgPhoto: meta.bgPhotoEnabled !== false,
    sat: meta.satEnabled !== false,
    fillersToggle: meta.fillersToggleEnabled !== false,
    survey: meta.surveyEnabled === true,
    annotate: meta.annotateEnabled !== false,
  };
}

export function overflowMenuVisible(tools: ShareViewerTools): boolean {
  return (
    tools.overflow &&
    (tools.glbAr || tools.bgPhoto || tools.sat || tools.fillersToggle)
  );
}
