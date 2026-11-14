import { describe, expect, it } from "vitest";
import { isReservedSlug } from "../../src/lib/constants/reserved-slugs";
import { isTechnicalPreviewHost } from "../../src/middleware";

describe("Standalone Subdomain Deployment (links.cristianarando.dev)", () => {
  it("allows former portfolio slugs to be shortened on links.cristianarando.dev while keeping system routes reserved", () => {
    for (const slug of ["projects", "uses", "blog", "about", "contact", "cv", "es", "en"]) {
      expect(
        isReservedSlug(slug),
        `El slug "${slug}" ya no debe estar bloqueado tras desacoplar my-portfolio`
      ).toBe(false);
    }

    for (const systemSlug of ["admin", "login", "api", "links", "_next", "favicon.ico"]) {
      expect(
        isReservedSlug(systemSlug),
        `La ruta de sistema "${systemSlug}" debe permanecer reservada`
      ).toBe(true);
    }
  });

  it("detecta dominios técnicos *.vercel.app para inyectar X-Robots-Tag: noindex, nofollow", () => {
    expect(isTechnicalPreviewHost("inside-link-cris.vercel.app")).toBe(true);
    expect(isTechnicalPreviewHost("inside-link-git-main.vercel.app:443")).toBe(true);
    expect(isTechnicalPreviewHost("links.cristianarando.dev")).toBe(false);
    expect(isTechnicalPreviewHost("localhost:3000")).toBe(false);
  });
});
