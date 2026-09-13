import type { RenderMeta } from "./types.js";

const DEFAULT_TTL_DAYS = 3;

export const VIEWER_TOOL_META_KEYS = [
  "surveyEnabled",
  "facadesEnabled",
  "dimsEnabled",
  "xrayEnabled",
  "freezeEnabled",
  "overflowEnabled",
  "glbArEnabled",
  "bgPhotoEnabled",
  "satEnabled",
  "fillersToggleEnabled",
  "annotateEnabled",
] as const;

export type ViewerToolMetaKey = (typeof VIEWER_TOOL_META_KEYS)[number];

export const DEFAULT_SHARE_BG_COLOR = "#1a1d24";

export function parseBgColor(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(t) ? t : undefined;
}

export function applyMetaScalars(from: Partial<RenderMeta>, to: RenderMeta): void {
  if (typeof from.fileSizeBytes === "number" && from.fileSizeBytes > 0) {
    to.fileSizeBytes = from.fileSizeBytes;
  }
  if (typeof from.totalChunks === "number" && from.totalChunks > 0) {
    to.totalChunks = from.totalChunks;
  }
  const bg = parseBgColor(from.bgColor);
  if (bg) to.bgColor = bg;
}

export function applyViewerToolFlags(
  from: Partial<Record<ViewerToolMetaKey, unknown>>,
  to: RenderMeta,
): void {
  for (const key of VIEWER_TOOL_META_KEYS) {
    if (typeof from[key] === "boolean") {
      to[key] = from[key];
    }
  }
}

export function defaultExpiresAt(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + DEFAULT_TTL_DAYS);
  return d.toISOString();
}

export function parseExpiresAt(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !raw.trim()) return defaultExpiresAt();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid expiresAt");
  }
  return d.toISOString();
}

export function parseExpiresAtJson(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("expiresAt required");
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid expiresAt");
  }
  return d.toISOString();
}

export function isExpired(meta: RenderMeta, now = Date.now()): boolean {
  return new Date(meta.expiresAt).getTime() <= now;
}

export function readMeta(raw: string | null): RenderMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RenderMeta;
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }
    const meta: RenderMeta = {
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };
    applyMetaScalars(parsed, meta);
    applyViewerToolFlags(parsed, meta);
    return meta;
  } catch {
    return null;
  }
}

export function siteBaseUrl(): string {
  return (
    process.env.URL?.replace(/\/$/, "") ||
    process.env.DEPLOY_PRIME_URL?.replace(/\/$/, "") ||
    "http://localhost:8888"
  );
}
