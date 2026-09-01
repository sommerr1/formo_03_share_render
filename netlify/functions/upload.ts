import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { parseExpiresAt, siteBaseUrl } from "../lib/meta.js";
import { putRender } from "../lib/store.js";
import { newToken } from "../lib/tokens.js";
import type { UploadResponse } from "../lib/types.js";

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const denied = requireAdmin(req);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart form" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return json({ error: "file required" }, 400);
  }

  let expiresAt: string;
  try {
    expiresAt = parseExpiresAt(form.get("expiresAt"));
  } catch {
    return json({ error: "Invalid expiresAt" }, 400);
  }

  const token = newToken();
  const createdAt = new Date().toISOString();
  const glb = await file.arrayBuffer();

  await putRender(token, glb, { createdAt, expiresAt });

  const body: UploadResponse = {
    token,
    url: `${siteBaseUrl()}/v/${token}`,
    expiresAt,
    createdAt,
  };
  return json(body, 201);
};

export const config: Config = {
  path: "/api/upload",
};
