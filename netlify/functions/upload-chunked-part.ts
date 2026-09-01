import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import {
  CHUNK_SIZE_BYTES,
  getUploadSession,
  putUploadPart,
} from "../lib/store.js";
import { parseToken } from "../lib/tokens.js";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "PUT") return json({ error: "Method not allowed" }, 405);

  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = parseToken(context.params.token);
  const indexRaw = context.params.index;
  const index = indexRaw != null ? Number(indexRaw) : NaN;
  if (!token || !Number.isInteger(index) || index < 0) {
    return json({ error: "Not found" }, 404);
  }

  const session = await getUploadSession(token);
  if (!session) return json({ error: "Upload session not found" }, 404);
  if (index >= session.totalChunks) {
    return json({ error: "Invalid chunk index" }, 400);
  }

  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > CHUNK_SIZE_BYTES) {
    return json({ error: "Invalid chunk size" }, 400);
  }

  await putUploadPart(token, index, data);

  return json({ ok: true, index });
};

export const config: Config = {
  path: "/api/upload/chunked/:token/:index",
};
