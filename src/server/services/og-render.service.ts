import type { LinkDTO } from "@/lib/types/link-dto";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getCanonicalBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CANONICAL_URL || "https://cristianarando.dev").replace(/\/+$/, "");
}

/**
 * Genera el documento HTML ligero con metadatos Open Graph y Twitter Cards
 * para crawlers de redes sociales (WhatsApp, LinkedIn, X, Discord, Slack, Telegram).
 * Jamás expone la URL de destino privada si el enlace está protegido por PIN.
 */
export function renderOpenGraphHtml(link: LinkDTO): string {
  const baseUrl = getCanonicalBaseUrl();
  const rawTitle = link.hasPin
    ? `${link.title} (Protegido)`
    : link.title;
  const rawDescription = link.hasPin
    ? "Enlace protegido con código PIN en cristianarando.dev."
    : link.description?.trim() ||
      (link.type === "HUB"
        ? `Micro-landing del proyecto ${link.title} en cristianarando.dev.`
        : `Enlace corto verificado en cristianarando.dev/${link.slug}.`);

  const canonicalShortUrl = `${baseUrl}/${link.slug}`;
  const rawImage = link.ogImageUrl?.trim() || `${baseUrl}/brand/og-default.png`;

  const title = escapeHtml(rawTitle);
  const description = escapeHtml(rawDescription);
  const ogUrl = escapeHtml(canonicalShortUrl);
  const ogImage = escapeHtml(rawImage);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${ogUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="cristianarando.dev" />
  <meta property="og:locale" content="es_BO" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta property="og:image" content="${ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${description}</p>
  </main>
</body>
</html>`;
}
