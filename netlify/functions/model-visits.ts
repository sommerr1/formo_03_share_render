import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { getRenderMeta } from "../lib/store.js";
import { parseToken } from "../lib/tokens.js";
import { visitAnalyticsEnabled } from "../lib/visitFlags.js";
import { listVisitEvents } from "../lib/visitStore.js";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  if (!visitAnalyticsEnabled()) {
    return json({ error: "Not found" }, 404);
  }

  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  const meta = await getRenderMeta(token);
  if (!meta) return json({ error: "Not found" }, 404);

  const url = new URL(req.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);

  const data = await listVisitEvents({ token, limit, offset });
  return json(data);
};

export const config: Config = {
  path: "/api/models/:token/visits",
};
