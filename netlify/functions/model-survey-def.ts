import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import {
  getRenderMeta,
  getRenderSurveyDef,
  putRenderSurveyDef,
  waitForRenderMeta,
} from "../lib/store.js";
import { parseShareSurveyDef } from "../lib/surveyDef.js";
import { parseToken } from "../lib/tokens.js";

const MAX_DEF_BYTES = 32 * 1024;

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const meta = await getRenderMeta(token);
    if (!meta || isExpired(meta)) return json({ error: "Not found" }, 404);
    const raw = await getRenderSurveyDef(token);
    if (!raw) return json({ error: "Not found" }, 404);
    try {
      const parsed = parseShareSurveyDef(JSON.parse(raw));
      if (!parsed) return json({ error: "Not found" }, 404);
      return json(parsed);
    } catch {
      return json({ error: "Not found" }, 404);
    }
  }

  if (req.method === "PUT") {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const meta = await waitForRenderMeta(token);
    if (!meta || isExpired(meta)) return json({ error: "Not found" }, 404);
    if (meta.surveyEnabled !== true) {
      return json({ error: "Survey disabled" }, 403);
    }

    const text = await req.text();
    if (text.length > MAX_DEF_BYTES) {
      return json({ error: "Def too large" }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const parsed = parseShareSurveyDef(body);
    if (!parsed) return json({ error: "Invalid def" }, 400);
    await putRenderSurveyDef(token, JSON.stringify(parsed));
    return json(parsed);
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/models/:token/survey/def",
};
