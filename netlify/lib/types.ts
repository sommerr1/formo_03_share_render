export type RenderMeta = {
  createdAt: string;
  expiresAt: string;
  /** GLB size in bytes (set on upload complete). */
  fileSizeBytes?: number;
  /** Upload/download chunk count (4 MB each). */
  totalChunks?: number;
  /** Studio background `#RRGGBB` when no photo backdrop. */
  bgColor?: string;
  surveyEnabled?: boolean;
  facadesEnabled?: boolean;
  dimsEnabled?: boolean;
  xrayEnabled?: boolean;
  freezeEnabled?: boolean;
  overflowEnabled?: boolean;
  glbArEnabled?: boolean;
  bgPhotoEnabled?: boolean;
  satEnabled?: boolean;
  fillersToggleEnabled?: boolean;
  annotateEnabled?: boolean;
};

/** Admin-only sidecar. Never returned from public GET /api/models/:token. */
export type RenderAdmin = {
  label?: string;
  notes?: string;
  address?: string;
};

export type RenderListItem = {
  token: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  label?: string;
  notes?: string;
  address?: string;
};

export type UploadResponse = {
  token: string;
  url: string;
  expiresAt: string;
  createdAt: string;
};
