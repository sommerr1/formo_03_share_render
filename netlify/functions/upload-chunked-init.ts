import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { parseExpiresAtJson, siteBaseUrl } from "../lib/meta.js";
import {
  CHUNK_SIZE_BYTES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNKS,
  putUploadSession,
} from "../lib/store.js";
import { newToken } from "../lib/tokens.js";

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const totalChunks =
    body && typeof body === "object" && "totalChunks" in body
      ? Number((body as { totalChunks: unknown }).totalChunks)
      : NaN;
  const fileSizeBytes =
    body && typeof body === "object" && "fileSizeBytes" in body
      ? Number((body as { fileSizeBytes: unknown }).fileSizeBytes)
      : NaN;

  if (
    !Number.isInteger(totalChunks) ||
    totalChunks < 1 ||
    totalChunks > MAX_UPLOAD_CHUNKS
  ) {
    return json({ error: "Invalid totalChunks" }, 400);
  }
  if (
    !Number.isInteger(fileSizeBytes) ||
    fileSizeBytes < 1 ||
    fileSizeBytes > MAX_UPLOAD_BYTES
  ) {
    return json({ error: "Invalid fileSizeBytes" }, 400);
  }
  const expectedChunks = Math.ceil(fileSizeBytes / CHUNK_SIZE_BYTES);
  if (totalChunks !== expectedChunks) {
    return json({ error: "totalChunks mismatch" }, 400);
  }

  let expiresAt: string;
  try {
    expiresAt = parseExpiresAtJson(
      body && typeof body === "object" && "expiresAt" in body
        ? (body as { expiresAt: unknown }).expiresAt
        : null,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid expiresAt";
    return json({ error: msg }, 400);
  }

  const token = newToken();
  const createdAt = new Date().toISOString();
  await putUploadSession(token, {
    createdAt,
    expiresAt,
    totalChunks,
    received: [],
  });

  return json(
    {
      token,
      chunkSize: CHUNK_SIZE_BYTES,
      url: `${siteBaseUrl()}/v/${token}`,
      expiresAt,
      createdAt,
    },
    201,
  );
};

export const config: Config = {
  path: "/api/upload/chunked/init",
};
