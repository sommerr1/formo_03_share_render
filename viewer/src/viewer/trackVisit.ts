const VISITOR_COOKIE = "formo_vid";
const SESSION_KEY = "formo_share_sid";
const SESSION_TS_KEY = "formo_share_sid_ts";
const SESSION_MS = 30 * 60 * 1000;
const COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return undefined;
}

function writeCookie(name: string, value: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function getOrCreateVisitorId(): string {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing && existing.length >= 8 && existing.length <= 64) return existing;
  const id = crypto.randomUUID();
  writeCookie(VISITOR_COOKIE, id);
  return id;
}

function getOrCreateSessionId(): string {
  const now = Date.now();
  const tsRaw = sessionStorage.getItem(SESSION_TS_KEY);
  const sid = sessionStorage.getItem(SESSION_KEY);
  const ts = tsRaw ? Number.parseInt(tsRaw, 10) : NaN;
  if (sid && Number.isFinite(ts) && now - ts < SESSION_MS) {
    sessionStorage.setItem(SESSION_TS_KEY, String(now));
    return sid;
  }
  const next = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, next);
  sessionStorage.setItem(SESSION_TS_KEY, String(now));
  return next;
}

/** Fire-and-forget visit beacon; never throws to caller. */
export function trackShareVisit(token: string): void {
  void (async () => {
    try {
      await fetch(`/api/models/${encodeURIComponent(token)}/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          sessionId: getOrCreateSessionId(),
          viewport: { w: window.innerWidth, h: window.innerHeight },
          screen: { w: window.screen.width, h: window.screen.height },
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          referrer: document.referrer || undefined,
          pageUrl: window.location.href,
        }),
        keepalive: true,
      });
    } catch {
      /* ignore */
    }
  })();
}
