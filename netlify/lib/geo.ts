import type { ShareVisitGeo } from "./types.js";

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

type IpWhoResponse = {
  success?: boolean;
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
  timezone?: { id?: string };
};

/** Best-effort geo lookup; never throws. */
export async function lookupGeo(ip: string): Promise<ShareVisitGeo | undefined> {
  if (!ip || isPrivateIp(ip)) return undefined;
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as IpWhoResponse;
    if (!data.success) return undefined;
    const geo: ShareVisitGeo = {};
    if (data.country) geo.country = data.country;
    if (data.country_code) geo.countryCode = data.country_code;
    if (data.city) geo.city = data.city;
    if (data.region) geo.region = data.region;
    if (data.timezone?.id) geo.timezone = data.timezone.id;
    return Object.keys(geo).length > 0 ? geo : undefined;
  } catch {
    return undefined;
  }
}
