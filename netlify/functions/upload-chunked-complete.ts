import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { siteBaseUrl } from "../lib/meta.js";
import { assembleAndFinalizeUpload } from "../lib/store.js";
import { parseToken } from "../lib/tokens.js";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  try {
    const meta = await assembleAndFinalizeUpload(token);
    return json({
      token,
      url: `${siteBaseUrl()}/v/${token}`,
      expiresAt: meta.expiresAt,
      createdAt: meta.createdAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Complete failed";
    return json({ error: msg }, 400);
  }
};

export const config: Config = {
  path: "/api/upload/chunked/:token/complete",
};
