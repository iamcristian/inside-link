import QRCode from "qrcode";

export interface QrGenerationOptions {
  slug: string;
  canonicalBaseUrl?: string;
  darkColor?: string;
  lightColor?: string;
  sizePx?: number;
  includeCenterBadge?: boolean;
}

export interface QrBundle {
  targetUrl: string;
  svg: string;
  pngDataUrl: string;
}

/**
 * Construye siempre el URL corto canónico (`https://cristianarando.dev/[slug]`),
 * ignorando cualquier host técnico `.vercel.app` (RNF-009 / RF-017).
 */
export function buildCanonicalQrTargetUrl(slug: string, canonicalBaseUrl?: string): string {
  const base = (
    canonicalBaseUrl ||
    process.env.NEXT_PUBLIC_CANONICAL_URL ||
    "https://cristianarando.dev"
  ).replace(/\/+$/, "");
  const cleanSlug = slug.trim().replace(/^\/+/, "").toLowerCase();
  return `${base}/${cleanSlug}`;
}

/**
 * Genera un código QR en SVG vectorial puro con corrección de errores nivel `H` (30%)
 * y opción de incrustar el monograma `CA` de `cristianarando.dev` en el centro.
 */
export async function generateQrCodeSvg(options: QrGenerationOptions): Promise<string> {
  const targetUrl = buildCanonicalQrTargetUrl(options.slug, options.canonicalBaseUrl);
  const darkColor = options.darkColor || "#09090b";
  const lightColor = options.lightColor || "#ffffff";
  const includeCenterBadge = options.includeCenterBadge ?? true;

  const rawSvg = await QRCode.toString(targetUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: options.sizePx ?? 1024,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });

  if (!includeCenterBadge) {
    return rawSvg;
  }

  // Incrustamos insignia central vectorial que ocupa <18% del área (seguro bajo ECC nivel H = 30%)
  const badgeOverlay = `<g id="cristianarando-brand-badge">
    <rect x="40%" y="40%" width="20%" height="20%" rx="4%" fill="${lightColor}" />
    <rect x="41.5%" y="41.5%" width="17%" height="17%" rx="3.2%" fill="#09090b" stroke="#10b981" stroke-width="0.6%" />
    <text x="50%" y="52.5%" text-anchor="middle" fill="#fafafa" font-family="ui-monospace, monospace" font-weight="700" font-size="6.5%">CA</text>
  </g></svg>`;

  return rawSvg.replace(/<\/svg>\s*$/i, badgeOverlay);
}

/**
 * Genera el código QR en formato Data URL PNG (`data:image/png;base64,...`) a `1024x1024px`.
 */
export async function generateQrCodePngDataUrl(options: QrGenerationOptions): Promise<string> {
  const targetUrl = buildCanonicalQrTargetUrl(options.slug, options.canonicalBaseUrl);
  const darkColor = options.darkColor || "#09090b";
  const lightColor = options.lightColor || "#ffffff";

  return QRCode.toDataURL(targetUrl, {
    type: "image/png",
    errorCorrectionLevel: "H",
    margin: 2,
    width: options.sizePx ?? 1024,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });
}

export async function generateQrBundle(options: QrGenerationOptions): Promise<QrBundle> {
  const targetUrl = buildCanonicalQrTargetUrl(options.slug, options.canonicalBaseUrl);
  const [svg, pngDataUrl] = await Promise.all([
    generateQrCodeSvg(options),
    generateQrCodePngDataUrl(options),
  ]);
  return {
    targetUrl,
    svg,
    pngDataUrl,
  };
}
