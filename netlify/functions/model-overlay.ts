import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { isExpired } from "../lib/meta.js";
import {
  getRenderMeta,
  getRenderOverlay,
  putRenderOverlay,
} from "../lib/store.js";
import { parseToken } from "../lib/tokens.js";

const MAX_OVERLAY_BYTES = 512 * 1024;

function isOverlayV1(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as {
    schemaVersion?: unknown;
    units?: unknown;
    dims?: unknown;
    actors?: unknown;
  };
  if (o.schemaVersion !== 1 || o.units !== "meters") return false;
  if (!o.dims || typeof o.dims !== "object") return false;
  const dims = o.dims as { withFacades?: unknown; withoutFacades?: unknown };
  if (!Array.isArray(dims.withFacades) || !Array.isArray(dims.withoutFacades)) {
    return false;
  }
  return Array.isArray(o.actors);
}

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  const meta = await getRenderMeta(token);
  if (!meta || isExpired(meta)) return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const raw = await getRenderOverlay(token);
    if (!raw) return json({ error: "Not found" }, 404);
    try {
      return json(JSON.parse(raw));
    } catch {
      return json({ error: "Not found" }, 404);
    }
  }

  if (req.method === "PUT") {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const text = await req.text();
    if (text.length > MAX_OVERLAY_BYTES) {
      return json({ error: "Overlay too large" }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!isOverlayV1(body)) {
      return json({ error: "Invalid overlay" }, 400);
    }
    await putRenderOverlay(token, JSON.stringify(body));
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/models/:token/overlay",
};
