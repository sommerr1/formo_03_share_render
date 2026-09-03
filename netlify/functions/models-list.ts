import type { Config } from "@netlify/functions";
import { requireAdmin } from "../lib/auth.js";
import { json, options } from "../lib/cors.js";
import { listRenderListItems } from "../lib/store.js";

export default async (req: Request) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const denied = requireAdmin(req);
  if (denied) return denied;

  const items = await listRenderListItems();
  return json({ items });
};

export const config: Config = {
  path: "/api/models",
};
