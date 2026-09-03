import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import {
  applyViewerToolFlags,
  isExpired,
  parseExpiresAtJson,
  VIEWER_TOOL_META_KEYS,
} from "../lib/meta.js";
import {
  deleteRender,
  getRenderAdmin,
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
    return json({
      ...meta,
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
    if (
      !hasExpiry &&
      Object.keys(toolPatch).length === 0 &&
      !adminMerged.touched
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
    applyViewerToolFlags(current, next);
    applyViewerToolFlags(toolPatch, next);
    if (hasExpiry || Object.keys(toolPatch).length > 0) {
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
