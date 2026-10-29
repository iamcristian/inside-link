/**
 * Ejemplo de Cloudflare Worker / Reverse Proxy para enrutar selectivamente
 * las rutas de InsideLink bajo el dominio principal https://cristianarando.dev
 * sin interceptar el portafolio Astro ni los códigos de idioma ISO 639-1.
 */

const INSIDE_LINK_ORIGIN = "https://inside-link.vercel.app";

const PORTFOLIO_RESERVED_PREFIXES = new Set([
  "es",
  "en",
  "de",
  "ru",
  "ja",
  "projects",
  "uses",
  "cv",
  "blog",
  "bookshelf",
  "library",
  "search",
  "series",
  "search-index",
  "news-sitemap",
  "rss",
  "about",
  "contact",
  "_astro",
  "assets",
  "images",
  "fonts",
  "icons",
  "brand",
]);

const SLUG_PATH_REGEX = /^\/([a-z0-9][a-z0-9-_]{2,99})\/?$/;

export function shouldProxyToInsideLink(pathname: string): boolean {
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname === "/links" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/v1/")
  ) {
    return true;
  }

  // Nunca interceptar archivos con extensión (.ico, .png, .xml, .txt, .js, .css)
  if (pathname.includes(".")) {
    return false;
  }

  const match = SLUG_PATH_REGEX.exec(pathname);
  if (!match) {
    return false;
  }

  const candidateSlug = match[1]!;
  if (candidateSlug.length < 3 || PORTFOLIO_RESERVED_PREFIXES.has(candidateSlug)) {
    return false;
  }

  return true;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!shouldProxyToInsideLink(url.pathname)) {
      return fetch(request);
    }

    const upstreamUrl = new URL(url.pathname + url.search, INSIDE_LINK_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);

    return fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });
  },
};
