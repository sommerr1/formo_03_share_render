import type { Config, Context } from "@netlify/functions";
import { json, options, withCors } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import {
  getRenderMeta,
  getRenderSurveyDef,
  getRenderSurveyImage,
  putRenderSurveyImage,
} from "../lib/store.js";
import { isJpegBytes, parseSurveySlot } from "../lib/survey.js";
import { parseShareSurveyDef } from "../lib/surveyDef.js";
import { parseToken } from "../lib/tokens.js";

export const MAX_SURVEY_IMAGE_BYTES = 400 * 1024;

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();

  const token = parseToken(context.params.token);
  const slot = parseSurveySlot(context.params.slot);
  if (!token || !slot) return json({ error: "Not found" }, 404);

  const meta = await getRenderMeta(token);
  if (!meta || isExpired(meta)) return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const buf = await getRenderSurveyImage(token, slot);
    if (!buf) return json({ error: "Not found" }, 404);
    return new Response(
      buf,
      withCors(
        {},
        {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=60",
        },
      ),
    );
  }

  if (req.method === "PUT") {
    if (meta.surveyEnabled !== true) {
      return json({ error: "Survey disabled" }, 403);
    }
    if (meta.annotateEnabled === false) {
      return json({ error: "Annotate disabled" }, 403);
    }
    const defRaw = await getRenderSurveyDef(token);
    if (defRaw) {
      try {
        const def = parseShareSurveyDef(JSON.parse(defRaw));
        const q = def?.questions.find((item) => item.id === slot);
        if (!q || !q.annotate) {
          return json({ error: "Annotate disabled" }, 403);
        }
      } catch {
        /* no usable def */
      }
    }
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_SURVEY_IMAGE_BYTES) {
      return json({ error: "Image too large" }, 413);
    }
    if (!isJpegBytes(buf)) {
      return json({ error: "Invalid jpeg" }, 400);
    }
    await putRenderSurveyImage(token, slot, buf);
    return json({ ok: true, slot });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/models/:token/survey/image/:slot",
};
