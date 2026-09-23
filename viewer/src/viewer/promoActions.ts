export type PromoContentScope = "both" | "gallery_only" | "model_only";

/** Stub GLB from gallery-only upload is well below this. */
export const EMPTY_GLB_BYTES = 8192;

export function parsePromoContentScope(
  meta: Record<string, unknown>,
): PromoContentScope | undefined {
  const v = meta.promoContentScope;
  if (v === "both" || v === "gallery_only" || v === "model_only") return v;
  return undefined;
}

export function hasRealGlb(meta: Record<string, unknown>): boolean {
  const n = meta.fileSizeBytes;
  return typeof n === "number" && n > EMPTY_GLB_BYTES;
}

export function promoShowModelActions(opts: {
  scope: PromoContentScope | undefined;
  framesCount: number;
  allow3D: boolean;
  meta: Record<string, unknown>;
}): boolean {
  const { scope, framesCount, allow3D, meta } = opts;
  if (!allow3D || !hasRealGlb(meta)) return false;
  if (scope === "gallery_only") return false;
  if (scope === "both") return framesCount > 0;
  if (scope === "model_only") return true;
  return framesCount > 0;
}
