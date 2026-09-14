import { customAlphabet } from "nanoid";
import { renderStore } from "./store.js";
import { lookupGeo } from "./geo.js";
import { isBotUserAgent, parseUserAgent } from "./ua.js";
import type {
  ShareVisitEvent,
  ShareVisitEventPublic,
  ShareVisitListResponse,
  ShareVisitUtm,
} from "./types.js";

const eventId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  16,
);

const VISIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_PER_HOUR = 30;

function visitKey(token: string, id: string): string {
  return `visits/${token}/${id}.json`;
}

function visitPrefix(token: string): string {
  return `visits/${token}/`;
}

function rateLimitKey(token: string, ipHash: string, hourKey: string): string {
  return `visits-ratelimit/${token}/${ipHash}/${hourKey}.json`;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.ADMIN_SECRET?.trim() || "formo-visit";
  const data = new TextEncoder().encode(`${ip}:${salt}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function hourBucket(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
}

function parseUtmFromUrl(raw?: string): ShareVisitUtm | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const source = url.searchParams.get("utm_source")?.trim();
    const medium = url.searchParams.get("utm_medium")?.trim();
    const campaign = url.searchParams.get("utm_campaign")?.trim();
    if (!source && !medium && !campaign) return undefined;
    return {
      ...(source ? { source } : {}),
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
    };
  } catch {
    return undefined;
  }
}

function asPositiveInt(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.round(v);
}

export type VisitPostBody = {
  visitorId?: string;
  sessionId?: string;
  viewport?: { w?: number; h?: number };
  screen?: { w?: number; h?: number };
  clientTimezone?: string;
  referrer?: string;
  pageUrl?: string;
};

async function checkRateLimit(
  token: string,
  ipHash: string,
): Promise<boolean> {
  const store = renderStore();
  const key = rateLimitKey(token, ipHash, hourBucket());
  const raw = await store.get(key, { type: "text" });
  const count = raw ? Number.parseInt(raw, 10) : 0;
  if (Number.isFinite(count) && count >= RATE_LIMIT_PER_HOUR) return false;
  await store.set(key, String((Number.isFinite(count) ? count : 0) + 1), {
    metadata: { contentType: "text/plain" },
  });
  return true;
}

export async function appendVisitEvent(opts: {
  token: string;
  req: Request;
  body?: VisitPostBody;
}): Promise<{ ok: true; skipped?: "bot" | "rate_limit" } | { ok: false }> {
  const { token, req, body } = opts;
  const ua = req.headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) return { ok: true, skipped: "bot" };

  const ip = clientIp(req);
  const ipHash = await hashIp(ip);
  if (!(await checkRateLimit(token, ipHash))) {
    return { ok: true, skipped: "rate_limit" };
  }

  const parsedUa = parseUserAgent(ua);
  const referrer =
    body?.referrer?.trim() ||
    req.headers.get("referer")?.trim() ||
    undefined;
  const utm = parseUtmFromUrl(body?.pageUrl) ?? parseUtmFromUrl(referrer);
  const geo = await lookupGeo(ip);

  const vw = asPositiveInt(body?.viewport?.w);
  const vh = asPositiveInt(body?.viewport?.h);
  const viewport = vw && vh ? { w: vw, h: vh } : undefined;
  const sw = asPositiveInt(body?.screen?.w);
  const sh = asPositiveInt(body?.screen?.h);
  const screen = sw && sh ? { w: sw, h: sh } : undefined;

  const event: ShareVisitEvent = {
    id: eventId(),
    token,
    visitedAt: new Date().toISOString(),
    sessionId:
      typeof body?.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim().slice(0, 64)
        : eventId(),
    ...(typeof body?.visitorId === "string" && body.visitorId.trim()
      ? { visitorId: body.visitorId.trim().slice(0, 64) }
      : {}),
    ip,
    ipHash,
    userAgent: ua.slice(0, 512),
    deviceType: parsedUa.deviceType,
    ...(parsedUa.browser ? { browser: parsedUa.browser } : {}),
    ...(parsedUa.os ? { os: parsedUa.os } : {}),
    ...(req.headers.get("accept-language")
      ? { acceptLanguage: req.headers.get("accept-language")!.slice(0, 128) }
      : {}),
    ...(referrer ? { referrer: referrer.slice(0, 512) } : {}),
    ...(utm ? { utm } : {}),
    ...(geo ? { geo } : {}),
    ...(viewport ? { viewport } : {}),
    ...(screen ? { screen } : {}),
    ...(typeof body?.clientTimezone === "string" && body.clientTimezone.trim()
      ? { clientTimezone: body.clientTimezone.trim().slice(0, 64) }
      : {}),
  };

  const store = renderStore();
  await store.set(visitKey(token, event.id), JSON.stringify(event), {
    metadata: { contentType: "application/json" },
  });
  return { ok: true };
}

function toPublicEvent(event: ShareVisitEvent): ShareVisitEventPublic {
  const { ip: _ip, ...rest } = event;
  return rest;
}

function visitorKey(event: ShareVisitEvent): string {
  return event.visitorId || event.ipHash;
}

function buildSummary(events: ShareVisitEvent[]): ShareVisitListResponse["summary"] {
  const visitors = new Set<string>();
  let lastVisitAt: string | undefined;
  for (const e of events) {
    visitors.add(visitorKey(e));
    if (!lastVisitAt || e.visitedAt > lastVisitAt) lastVisitAt = e.visitedAt;
  }
  return {
    totalViews: events.length,
    uniqueVisitors: visitors.size,
    ...(lastVisitAt ? { lastVisitAt } : {}),
  };
}

async function loadVisitEvents(token: string): Promise<ShareVisitEvent[]> {
  const store = renderStore();
  const events: ShareVisitEvent[] = [];
  const { blobs } = await store.list({ prefix: visitPrefix(token) });
  for (const blob of blobs) {
    if (!blob.key.endsWith(".json")) continue;
    const raw = await store.get(blob.key, { type: "text" });
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as ShareVisitEvent;
      if (
        typeof parsed.id === "string" &&
        typeof parsed.visitedAt === "string"
      ) {
        events.push(parsed);
      }
    } catch {
      /* skip */
    }
  }
  events.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  return events;
}

export async function listVisitEvents(opts: {
  token: string;
  limit?: number;
  offset?: number;
}): Promise<ShareVisitListResponse> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const all = await loadVisitEvents(opts.token);
  const slice = all.slice(offset, offset + limit);
  return {
    items: slice.map(toPublicEvent),
    summary: buildSummary(all),
  };
}

export async function deleteRenderVisits(token: string): Promise<void> {
  const store = renderStore();
  for (const prefix of [visitPrefix(token), `visits-ratelimit/${token}/`]) {
    const { blobs } = await store.list({ prefix });
    for (const blob of blobs) {
      await store.delete(blob.key);
    }
  }
}

export async function purgeOldVisits(now = Date.now()): Promise<number> {
  const store = renderStore();
  const cutoff = now - VISIT_RETENTION_MS;
  let removed = 0;
  const { blobs } = await store.list({ prefix: "visits/" });
  for (const blob of blobs) {
    if (!blob.key.endsWith(".json")) continue;
    const raw = await store.get(blob.key, { type: "text" });
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as ShareVisitEvent;
      if (new Date(parsed.visitedAt).getTime() < cutoff) {
        await store.delete(blob.key);
        removed += 1;
      }
    } catch {
      await store.delete(blob.key);
      removed += 1;
    }
  }
  return removed;
}
