import { isSocialPreviewBot } from "./bot-detector";

export interface TrafficMetadata {
  country: string;
  city: string | null;
  device: "desktop" | "mobile" | "tablet" | "bot";
  os: "Windows" | "macOS" | "Android" | "iOS" | "Linux" | "Other";
  browser: "Chrome" | "Safari" | "Firefox" | "Edge" | "Other";
  referrer: string;
  queryParamRef: string | null;
}

export function extractTrafficMetadata(
  headers: Headers | Record<string, string | string[] | undefined>,
  searchParams?: URLSearchParams | Record<string, string | undefined>
): TrafficMetadata {
  const getHeader = (name: string): string | null => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const val = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || null;
    return val || null;
  };

  // 1. País (prioridad: x-vercel-ip-country -> cf-ipcountry -> 'XX')
  let country = (getHeader("x-vercel-ip-country") || getHeader("cf-ipcountry") || "XX").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    country = "XX";
  }

  // 2. Ciudad (x-vercel-ip-city -> cf-ipcity -> null)
  let city: string | null = null;
  const rawCity = getHeader("x-vercel-ip-city") || getHeader("cf-ipcity");
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).trim().slice(0, 100);
    } catch {
      city = rawCity.trim().slice(0, 100);
    }
  }

  // 3. User-Agent
  const ua = getHeader("user-agent") || "";

  // 4. Dispositivo
  let device: "desktop" | "mobile" | "tablet" | "bot" = "desktop";
  if (isSocialPreviewBot(ua) || /bot|crawler|spider/i.test(ua)) {
    device = "bot";
  } else if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    device = "tablet";
  } else if (/mobile|iphone|ipod|android/i.test(ua)) {
    device = "mobile";
  }

  // 5. Sistema Operativo
  let os: "Windows" | "macOS" | "Android" | "iOS" | "Linux" | "Other" = "Other";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // 6. Navegador
  let browser: "Chrome" | "Safari" | "Firefox" | "Edge" | "Other" = "Other";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";

  // 7. Referrer
  let referrer = "Direct";
  const rawReferrer = getHeader("referer");
  if (rawReferrer) {
    try {
      const refUrl = new URL(rawReferrer);
      referrer = refUrl.hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      referrer = "Direct";
    }
  }

  // 8. Query Param Ref (?ref= o ?utm_source=)
  let queryParamRef: string | null = null;
  if (searchParams) {
    const getParam = (key: string): string | null => {
      if (typeof (searchParams as URLSearchParams).get === "function") {
        return (searchParams as URLSearchParams).get(key);
      }
      return (searchParams as Record<string, string | undefined>)[key] || null;
    };

    const ref = getParam("ref") || getParam("utm_source");
    if (ref) {
      queryParamRef = ref.trim().slice(0, 64);
    }
  }

  return {
    country,
    city,
    device,
    os,
    browser,
    referrer,
    queryParamRef,
  };
}
