import type { Config, Context } from "@netlify/functions";
import { withCors } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import {
  DOWNLOAD_CHUNK_BYTES,
  getRenderGlbChunk,
  getRenderMeta,
} from "../lib/store.js";
import { parseToken } from "../lib/tokens.js";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, withCors({ status: 204 }));
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = parseToken(context.params.token);
  if (!token) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const index = Number(context.params.index);
  if (!Number.isInteger(index) || index < 0) {
    return new Response(JSON.stringify({ error: "Invalid chunk index" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const meta = await getRenderMeta(token);
  if (!meta || isExpired(meta)) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const chunk = await getRenderGlbChunk(token, index);
  if (!chunk) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(chunk, withCors({}, {
    "Content-Type": "application/octet-stream",
    "Content-Length": String(chunk.byteLength),
    "X-Chunk-Size": String(DOWNLOAD_CHUNK_BYTES),
    "Cache-Control": "private, max-age=3600",
  }));
};

export const config: Config = {
  path: "/api/models/:token/file/chunk/:index",
};
