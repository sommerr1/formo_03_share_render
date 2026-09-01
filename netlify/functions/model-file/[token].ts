import type { Config, Context } from "@netlify/functions";
import { withCors } from "../../lib/cors.js";
import { isExpired } from "../../lib/meta.js";
import { getRenderGlb, getRenderMeta } from "../../lib/store.js";
import { parseToken } from "../../lib/tokens.js";

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

  const meta = await getRenderMeta(token);
  if (!meta || isExpired(meta)) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const glb = await getRenderGlb(token);
  if (!glb) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(glb, withCors({}, {
    "Content-Type": "model/gltf-binary",
    "Cache-Control": "private, max-age=3600",
  }));
};

export const config: Config = {
  path: "/api/models/:token/file",
};
