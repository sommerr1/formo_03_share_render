export type RenderMeta = {
  createdAt: string;
  expiresAt: string;
  surveyEnabled?: boolean;
};

export type UploadResponse = {
  token: string;
  url: string;
  expiresAt: string;
  createdAt: string;
};
