import type { Config, Context } from "@netlify/functions";
import { json, options } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import {
  getRenderMeta,
  getRenderSurvey,
  putRenderSurvey,
} from "../lib/store.js";
import { isSurveyDraft, parseShareSurvey, type ShareSurveyV1 } from "../lib/survey.js";
import { parseToken } from "../lib/tokens.js";

const MAX_SURVEY_BYTES = 16 * 1024;

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  const meta = await getRenderMeta(token);
  if (!meta || isExpired(meta)) return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const raw = await getRenderSurvey(token);
    if (!raw) return json({ error: "Not found" }, 404);
    try {
      const parsed = parseShareSurvey(JSON.parse(raw));
      if (!parsed) return json({ error: "Not found" }, 404);
      return json(parsed);
    } catch {
      return json({ error: "Not found" }, 404);
    }
  }

  if (req.method === "PUT") {
    if (meta.surveyEnabled !== true) {
      return json({ error: "Survey disabled" }, 403);
    }

    const text = await req.text();
    if (text.length > MAX_SURVEY_BYTES) {
      return json({ error: "Survey too large" }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!isSurveyDraft(body)) {
      return json({ error: "Invalid survey" }, 400);
    }

    const stored: ShareSurveyV1 = {
      schemaVersion: 1,
      submittedAt: new Date().toISOString(),
      items: body.items,
      other: body.other,
    };
    await putRenderSurvey(token, JSON.stringify(stored));
    return json(stored);
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/models/:token/survey",
};
