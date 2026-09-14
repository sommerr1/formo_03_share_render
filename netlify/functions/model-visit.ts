import type { Config, Context } from "@netlify/functions";
import { json, options } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import { getRenderMeta } from "../lib/store.js";
import { parseToken } from "../lib/tokens.js";
import { visitAnalyticsEnabled } from "../lib/visitFlags.js";
import { appendVisitEvent, type VisitPostBody } from "../lib/visitStore.js";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!visitAnalyticsEnabled()) {
    return json({ ok: true, disabled: true });
  }

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  const meta = await getRenderMeta(token);
  if (!meta || isExpired(meta)) return json({ error: "Not found" }, 404);

  let body: VisitPostBody = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      const parsed = JSON.parse(text) as VisitPostBody;
      if (parsed && typeof parsed === "object") body = parsed;
    }
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const result = await appendVisitEvent({ token, req, body });
  if (!result.ok) return json({ error: "Failed" }, 500);
  return json({ ok: true, ...(result.skipped ? { skipped: result.skipped } : {}) });
};

export const config: Config = {
  path: "/api/models/:token/visit",
};
