import { json } from "./cors.js";

export function requireAdmin(req: Request): Response | null {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    return json({ error: "Server misconfigured" }, 500);
  }
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}
