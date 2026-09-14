import type { Config } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { visitAnalyticsEnabled } from "../lib/visitFlags.js";
import { buildAnalyticsSummary } from "../lib/visitStore.js";

export default async (req: Request) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  if (!visitAnalyticsEnabled()) {
    return json({ error: "Not found" }, 404);
  }

  const denied = requireAdmin(req);
  if (denied) return denied;

  const data = await buildAnalyticsSummary();
  return json(data);
};

export const config: Config = {
  path: "/api/analytics/summary",
};
