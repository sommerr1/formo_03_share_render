export type RenderMeta = {
  createdAt: string;
  expiresAt: string;
  surveyEnabled?: boolean;
  facadesEnabled?: boolean;
  dimsEnabled?: boolean;
  xrayEnabled?: boolean;
  freezeEnabled?: boolean;
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
