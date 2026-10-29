import { NextResponse, type NextRequest } from "next/server";

/**
 * Expresión regular oficial usada en `vercel.rewrites.json` para reenviar únicamente
 * slugs de un solo segmento (>= 3 caracteres, sin puntos ni rutas del portafolio).
 */
export const PORTFOLIO_SLUG_REWRITE_REGEX =
  /^\/(?!(?:es|en|de|ru|ja|projects|uses|cv|blog|bookshelf|library|search|series|search-index|news-sitemap|rss|about|contact|_astro|_next|assets|images|fonts|icons|brand)$)([a-z0-9][a-z0-9-_]{2,99})\/?$/;

export function matchesPortfolioRewrite(pathname: string): boolean {
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
  return PORTFOLIO_SLUG_REWRITE_REGEX.test(pathname);
}

export function isTechnicalPreviewHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const cleanHost = hostHeader.split(":")[0]?.trim().toLowerCase() ?? "";
  return cleanHost.endsWith(".vercel.app");
}

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

  // RNF-009 (Corrección C-05): Evitar indexación duplicada del dominio técnico *.vercel.app
  if (isTechnicalPreviewHost(host)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // RNF-008 (Corrección C-01): Permitir carga de assets estáticos desde cristianarando.dev
  if (request.nextUrl.pathname.startsWith("/_next/static/")) {
    const canonicalOrigin = (
      process.env.NEXT_PUBLIC_CANONICAL_URL || "https://cristianarando.dev"
    ).replace(/\/+$/, "");
    response.headers.set("Access-Control-Allow-Origin", canonicalOrigin);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/image|favicon.ico).*)"],
};
