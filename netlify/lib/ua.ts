import type { ShareVisitDeviceType } from "./types.js";

export type ParsedUa = {
  deviceType: ShareVisitDeviceType;
  browser?: string;
  os?: string;
};

export function parseUserAgent(ua: string): ParsedUa {
  const s = ua.trim();
  if (!s) return { deviceType: "unknown" };

  const lower = s.toLowerCase();
  let deviceType: ShareVisitDeviceType = "desktop";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(s)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(s)) {
    deviceType = "mobile";
  }

  let browser: string | undefined;
  if (/edg\//i.test(s)) browser = "Edge";
  else if (/opr\//i.test(s) || /opera/i.test(s)) browser = "Opera";
  else if (/chrome\//i.test(s) && !/edg\//i.test(s)) browser = "Chrome";
  else if (/safari\//i.test(s) && !/chrome\//i.test(s)) browser = "Safari";
  else if (/firefox\//i.test(s)) browser = "Firefox";

  let os: string | undefined;
  if (/windows nt/i.test(s)) os = "Windows";
  else if (/mac os x|macintosh/i.test(s)) os = "macOS";
  else if (/android/i.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(s)) os = "iOS";
  else if (/linux/i.test(s)) os = "Linux";

  if (/bot|crawl|spider|slurp|facebookexternalhit|telegrambot|whatsapp|preview|headless/i.test(lower)) {
    deviceType = "unknown";
  }

  return { deviceType, browser, os };
}

export function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return /bot|crawl|spider|slurp|facebookexternalhit|telegrambot|whatsapp|preview|headless|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|embedly|quora link preview|vkshare|wget|curl\//i.test(
    lower,
  );
}
