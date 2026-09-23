export type RenderMeta = {
  createdAt: string;
  expiresAt: string;
  /** GLB size in bytes (set on upload complete). */
  fileSizeBytes?: number;
  /** Upload/download chunk count (4 MB each). */
  totalChunks?: number;
  /** Studio background `#RRGGBB` when no photo backdrop. */
  bgColor?: string;
  shareMode?: "survey" | "promo";
  promoContentScope?: "both" | "gallery_only" | "model_only";
  promoManifest?: unknown;
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

export type ShareVisitDeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export type ShareVisitGeo = {
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  timezone?: string;
};

export type ShareVisitUtm = {
  source?: string;
  medium?: string;
  campaign?: string;
};

/** Stored in blobs; `ip` is admin-only and stripped from public list API. */
export type ShareVisitEvent = {
  id: string;
  token: string;
  visitedAt: string;
  sessionId: string;
  visitorId?: string;
  ip: string;
  ipHash: string;
  userAgent: string;
  deviceType: ShareVisitDeviceType;
  browser?: string;
  os?: string;
  acceptLanguage?: string;
  referrer?: string;
  utm?: ShareVisitUtm;
  geo?: ShareVisitGeo;
  viewport?: { w: number; h: number };
  screen?: { w: number; h: number };
  clientTimezone?: string;
};

/** Admin GET only — includes IP. */
export type ShareVisitAdminItem = Omit<ShareVisitEvent, "ip"> & { ip: string };

export type ShareVisitSummary = {
  totalViews: number;
  uniqueVisitors: number;
  lastVisitAt?: string;
};

export type ShareVisitListResponse = {
  items: ShareVisitAdminItem[];
  summary: ShareVisitSummary;
};

export type ShareVisitTokenSummary = {
  token: string;
  summary: ShareVisitSummary;
};

export type ShareVisitRepeatVisitor = {
  visitorKey: string;
  tokenCount: number;
  tokens: string[];
};

export type ShareAnalyticsSummaryResponse = {
  global: ShareVisitSummary;
  byToken: ShareVisitTokenSummary[];
  repeatVisitors: ShareVisitRepeatVisitor[];
};
