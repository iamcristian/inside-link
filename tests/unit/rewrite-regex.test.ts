import { describe, expect, it } from "vitest";
import { shouldProxyToInsideLink } from "../../docs/portfolio-integration/cloudflare-worker-proxy.example";
import {
  isTechnicalPreviewHost,
  matchesPortfolioRewrite,
  PORTFOLIO_SLUG_REWRITE_REGEX,
} from "../../src/middleware";

describe("T-022: Coexistencia con Portafolio cristianarando.dev y Reglas de Rewrite", () => {
  const PORTFOLIO_PATHS_MUST_NOT_MATCH = [
    "/",
    "/es",
    "/es/",
    "/en",
    "/en/",
    "/de",
    "/ru",
    "/ja",
    "/es/projects",
    "/en/projects/inside-link",
    "/en/bookshelf/",
    "/es/library/",
    "/en/search/",
    "/en/series/",
    "/search-index.json",
    "/en/news-sitemap.xml",
    "/rss.xml",
    "/projects",
    "/uses",
    "/cv",
    "/blog",
    "/bookshelf",
    "/library",
    "/search",
    "/series",
    "/about",
    "/contact",
    "/_astro/main.hash123.js",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/og-image.png",
  ];

  const VALID_INSIDELINK_PATHS_MUST_MATCH = [
    "/github",
    "/linkedin",
    "/cv-pdf",
    "/proyecto-guia-turistica",
    "/sistema-pos",
    "/a9x2k7",
    "/links",
    "/admin",
    "/admin/analytics",
    "/login",
    "/api/v1/links",
    "/api/auth/session",
  ];

  it("garantiza que el 100% de las rutas del portafolio NO hacen match con el Rewrite de InsideLink", () => {
    for (const path of PORTFOLIO_PATHS_MUST_NOT_MATCH) {
      expect(
        PORTFOLIO_SLUG_REWRITE_REGEX.test(path),
        `La ruta del portafolio "${path}" no debe coincidir con PORTFOLIO_SLUG_REWRITE_REGEX`
      ).toBe(false);
      expect(
        matchesPortfolioRewrite(path),
        `La ruta del portafolio "${path}" no debe ser reenviada a InsideLink`
      ).toBe(false);
      expect(
        shouldProxyToInsideLink(path),
        `El Worker no debe interceptar la ruta del portafolio "${path}"`
      ).toBe(false);
    }
  });

  it("garantiza que el 100% de los enlaces cortos y rutas de InsideLink SÍ hacen match", () => {
    for (const path of VALID_INSIDELINK_PATHS_MUST_MATCH) {
      expect(
        matchesPortfolioRewrite(path),
        `La ruta de InsideLink "${path}" debe coincidir con matchesPortfolioRewrite`
      ).toBe(true);
      expect(
        shouldProxyToInsideLink(path),
        `La ruta de InsideLink "${path}" debe coincidir con shouldProxyToInsideLink`
      ).toBe(true);
    }
  });

  it("detecta dominios técnicos *.vercel.app para inyectar X-Robots-Tag: noindex, nofollow", () => {
    expect(isTechnicalPreviewHost("inside-link-cris.vercel.app")).toBe(true);
    expect(isTechnicalPreviewHost("inside-link-git-main.vercel.app:443")).toBe(true);
    expect(isTechnicalPreviewHost("cristianarando.dev")).toBe(false);
    expect(isTechnicalPreviewHost("localhost:3000")).toBe(false);
  });
});
