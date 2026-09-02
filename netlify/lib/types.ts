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

export type UploadResponse = {
  token: string;
  url: string;
  expiresAt: string;
  createdAt: string;
};
