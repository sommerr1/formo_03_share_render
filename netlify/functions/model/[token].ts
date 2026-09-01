import type { Config, Context } from "@netlify/functions";
import { requireAdmin } from "../../lib/auth.js";
import { json, options } from "../../lib/cors.js";
import { isExpired, parseExpiresAtJson } from "../../lib/meta.js";
import {
  deleteRender,
  getRenderMeta,
  patchRenderMeta,
} from "../../lib/store.js";
import { parseToken } from "../../lib/tokens.js";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return options();

  const token = parseToken(context.params.token);
  if (!token) return json({ error: "Not found" }, 404);

  if (req.method === "GET") {
    const meta = await getRenderMeta(token);
    if (!meta || isExpired(meta)) {
      return json({ error: "Not found" }, 404);
    }
    return json(meta);
  }

  if (req.method === "PATCH") {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const current = await getRenderMeta(token);
    if (!current) return json({ error: "Not found" }, 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
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

    const next = { ...current, expiresAt };
    await patchRenderMeta(token, next);
    return json(next);
  }

  if (req.method === "DELETE") {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const current = await getRenderMeta(token);
    if (!current) return json({ error: "Not found" }, 404);
    await deleteRender(token);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/models/:token",
};
