import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import {
  applyMetaScalars,
  applyViewerToolFlags,
  isExpired,
  parseBgColor,
  parseExpiresAtJson,
  VIEWER_TOOL_META_KEYS,
} from "../lib/meta.js";
import {
  deleteRender,
  getRenderAdmin,
  getRenderFileSize,
  getRenderMeta,
  getRenderSurvey,
  mergeAdminPatch,
  patchRenderMeta,
  putRenderAdmin,
} from "../lib/store.js";
import { surveySubmittedAtFromRaw } from "../lib/survey.js";
import { parseToken } from "../lib/tokens.js";
import type { RenderMeta } from "../lib/types.js";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const meta = await getRenderMeta(token);
    if (!meta || isExpired(meta)) {
      return json({ error: "Not found" }, 404);
    }
    const surveySubmittedAt = surveySubmittedAtFromRaw(
      await getRenderSurvey(token),
    );
    const fileSizeBytes =
      meta.fileSizeBytes ?? (await getRenderFileSize(token)) ?? undefined;
    return json({
      ...meta,
      ...(fileSizeBytes != null ? { fileSizeBytes } : {}),
      ...(surveySubmittedAt ? { surveySubmittedAt } : {}),
    });
  }

  if (req.method === "PATCH") {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const current = await getRenderMeta(token);
    if (!current) return json({ error: "Not found" }, 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (!body || typeof body !== "object") {
      return json({ error: "Invalid JSON" }, 400);
    }
    const rec = body as Record<string, unknown>;
    const hasExpiry = "expiresAt" in rec;
    const hasBgColor = "bgColor" in rec;
    const hasShareMode = "shareMode" in rec;
    const hasPromoManifest = "promoManifest" in rec;
    const hasPromoContentScope = "promoContentScope" in rec;
    const toolPatch: Partial<RenderMeta> = {};
    for (const key of VIEWER_TOOL_META_KEYS) {
      if (!(key in rec)) continue;
      if (typeof rec[key] !== "boolean") {
        return json({ error: `Invalid ${key}` }, 400);
      }
      toolPatch[key] = rec[key];
    }
    const adminMerged = mergeAdminPatch(
      (await getRenderAdmin(token)) ?? {},
      rec,
    );
    if ("error" in adminMerged) {
      return json({ error: adminMerged.error }, 400);
    }
    let bgColorPatch: string | undefined;
    if (hasBgColor) {
      if (rec.bgColor === null || rec.bgColor === "") {
        bgColorPatch = undefined;
      } else {
        const parsed = parseBgColor(rec.bgColor);
        if (!parsed) return json({ error: "Invalid bgColor" }, 400);
        bgColorPatch = parsed;
      }
    }

    if (
      !hasExpiry &&
      Object.keys(toolPatch).length === 0 &&
      !adminMerged.touched &&
      !hasBgColor &&
      !hasShareMode &&
      !hasPromoManifest &&
      !hasPromoContentScope
    ) {
      return json({ error: "expiresAt, tool flags or admin fields required" }, 400);
    }

    let expiresAt = current.expiresAt;
    if (hasExpiry) {
      try {
        expiresAt = parseExpiresAtJson(rec.expiresAt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid expiresAt";
        return json({ error: msg }, 400);
      }
    }

    const next: RenderMeta = {
      createdAt: current.createdAt,
      expiresAt,
    };
    applyMetaScalars(current, next);
    applyViewerToolFlags(current, next);
    applyViewerToolFlags(toolPatch, next);
    if (hasBgColor) {
      if (bgColorPatch) next.bgColor = bgColorPatch;
      else delete next.bgColor;
    }
    if (hasShareMode) {
      if (rec.shareMode === "survey" || rec.shareMode === "promo") {
        next.shareMode = rec.shareMode;
      }
    }
    if (hasPromoManifest) {
      next.promoManifest = rec.promoManifest;
    }
    if (hasPromoContentScope) {
      const scope = rec.promoContentScope;
      if (
        scope === "both" ||
        scope === "gallery_only" ||
        scope === "model_only"
      ) {
        next.promoContentScope = scope;
      } else if (scope === null) {
        delete next.promoContentScope;
      } else {
        return json({ error: "Invalid promoContentScope" }, 400);
      }
    }
    if (
      hasExpiry ||
      Object.keys(toolPatch).length > 0 ||
      hasBgColor ||
      hasShareMode ||
      hasPromoManifest ||
      hasPromoContentScope
    ) {
      await patchRenderMeta(token, next);
    }
    if (adminMerged.touched) {
      await putRenderAdmin(token, adminMerged.admin);
    }

    const surveySubmittedAt = surveySubmittedAtFromRaw(
      await getRenderSurvey(token),
    );
    return json({
      ...next,
      ...(surveySubmittedAt ? { surveySubmittedAt } : {}),
    });
  }

  if (req.method === "DELETE") {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const current = await getRenderMeta(token);
    if (!current) return json({ error: "Not found" }, 404);
    await deleteRender(token);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/models/:token",
};
