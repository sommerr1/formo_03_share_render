import type { Config, Context } from "@netlify/functions";
import { json, options } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import {
  getRenderMeta,
  getRenderSurvey,
  getRenderSurveyDef,
  listSurveyImageFlags,
  putRenderSurvey,
} from "../lib/store.js";
import {
  isSurveyDraft,
  isSurveyDraftV3,
  parseShareSurvey,
  type ShareSurvey,
} from "../lib/survey.js";
import { parseShareSurveyDef } from "../lib/surveyDef.js";
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

    const submittedAt = new Date().toISOString();
    const flags = await listSurveyImageFlags(token);
    const imagesV12 = {
      ...(flags.dims ? { dims: true as const } : {}),
      ...(flags.decor ? { decor: true as const } : {}),
      ...(flags.facades ? { facades: true as const } : {}),
      ...(flags.other ? { other: true as const } : {}),
    };

    if (isSurveyDraftV3(body)) {
      const defRaw = await getRenderSurveyDef(token);
      if (defRaw) {
        try {
          const def = parseShareSurveyDef(JSON.parse(defRaw));
          if (def) {
            let any = false;
            for (const q of def.questions) {
              const ans = body.items[q.id];
              if (!ans) return json({ error: "Invalid survey" }, 400);
              if (ans.status === "ok" || ans.status === "not_ok") any = true;
              if (ans.comment.trim()) any = true;
            }
            if (!any) {
              for (const v of Object.values(flags)) {
                if (v) any = true;
              }
            }
            if (!any) return json({ error: "Empty survey" }, 400);
          }
        } catch {
          /* no def — accept well-formed v3 */
        }
      }
      const stored: ShareSurvey = {
        schemaVersion: 3,
        submittedAt,
        items: body.items,
        images: flags,
      };
      await putRenderSurvey(token, JSON.stringify(stored));
      return json(stored);
    }

    if (!isSurveyDraft(body)) {
      return json({ error: "Invalid survey" }, 400);
    }

    const stored: ShareSurvey =
      body.schemaVersion === 2
        ? {
            schemaVersion: 2,
            submittedAt,
            items: body.items,
            other: body.other,
            images: imagesV12,
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
