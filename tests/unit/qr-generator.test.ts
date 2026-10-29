import { describe, expect, it } from "vitest";
import {
  buildCanonicalQrTargetUrl,
  generateQrBundle,
  generateQrCodePngDataUrl,
  generateQrCodeSvg,
} from "../../src/lib/qr-generator";

describe("T-018: Generador de Códigos QR Personalizados (SVG y PNG)", () => {
  it("apunta siempre al dominio canónico https://cristianarando.dev/[slug]", () => {
    expect(buildCanonicalQrTargetUrl("github", "https://cristianarando.dev/")).toBe(
      "https://cristianarando.dev/github"
    );
    expect(buildCanonicalQrTargetUrl("/Proyecto-Demo", "https://cristianarando.dev")).toBe(
      "https://cristianarando.dev/proyecto-demo"
    );
  });

  it("genera SVG vectorial válido con insignia CA opcional y PNG base64", async () => {
    const svgWithBadge = await generateQrCodeSvg({
      slug: "linkedin",
      canonicalBaseUrl: "https://cristianarando.dev",
      includeCenterBadge: true,
    });
    expect(svgWithBadge).toContain("<svg");
    expect(svgWithBadge).toContain("cristianarando-brand-badge");
    expect(svgWithBadge).toContain("</svg>");

    const svgPlain = await generateQrCodeSvg({
      slug: "linkedin",
      canonicalBaseUrl: "https://cristianarando.dev",
      includeCenterBadge: false,
    });
    expect(svgPlain).toContain("<svg");
    expect(svgPlain).not.toContain("cristianarando-brand-badge");

    const pngDataUrl = await generateQrCodePngDataUrl({
      slug: "linkedin",
      canonicalBaseUrl: "https://cristianarando.dev",
      sizePx: 512,
    });
    expect(pngDataUrl.startsWith("data:image/png;base64,")).toBe(true);

    const bundle = await generateQrBundle({
      slug: "cv-pdf",
      canonicalBaseUrl: "https://cristianarando.dev",
    });
    expect(bundle.targetUrl).toBe("https://cristianarando.dev/cv-pdf");
  });
});
