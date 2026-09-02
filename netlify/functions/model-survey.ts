import type { Config, Context } from "@netlify/functions";
import { json, options } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import {
  getRenderMeta,
  getRenderSurvey,
  listSurveyImageFlags,
  putRenderSurvey,
} from "../lib/store.js";
import {
  isSurveyDraft,
  parseShareSurvey,
  type ShareSurvey,
} from "../lib/survey.js";
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

    const submittedAt = new Date().toISOString();
    const stored: ShareSurvey =
      body.schemaVersion === 2
        ? {
            schemaVersion: 2,
            submittedAt,
            items: body.items,
            other: body.other,
            images: await listSurveyImageFlags(token),
          }
        : {
            schemaVersion: 1,
            submittedAt,
            items: body.items,
            other: body.other,
            images: {},
          };
    await putRenderSurvey(token, JSON.stringify(stored));
    return json(stored);
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/models/:token/survey",
};
