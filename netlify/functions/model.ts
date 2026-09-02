import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { isExpired, parseExpiresAtJson } from "../lib/meta.js";
import {
  deleteRender,
  getRenderMeta,
  getRenderSurvey,
  patchRenderMeta,
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
    const patch = body as { expiresAt?: unknown; surveyEnabled?: unknown };
    const hasExpiry = "expiresAt" in patch;
    const hasSurvey = "surveyEnabled" in patch;
    if (!hasExpiry && !hasSurvey) {
      return json({ error: "expiresAt or surveyEnabled required" }, 400);
    }

    let expiresAt = current.expiresAt;
    if (hasExpiry) {
      try {
        expiresAt = parseExpiresAtJson(patch.expiresAt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid expiresAt";
        return json({ error: msg }, 400);
      }
    }

    let surveyEnabled = current.surveyEnabled;
    if (hasSurvey) {
      if (typeof patch.surveyEnabled !== "boolean") {
        return json({ error: "Invalid surveyEnabled" }, 400);
      }
      surveyEnabled = patch.surveyEnabled;
    }

    const next: RenderMeta = {
      createdAt: current.createdAt,
      expiresAt,
    };
    if (typeof surveyEnabled === "boolean") {
      next.surveyEnabled = surveyEnabled;
    }
    await patchRenderMeta(token, next);

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
