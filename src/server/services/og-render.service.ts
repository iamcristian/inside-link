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
    ? `${link.title} (Protected)`
    : link.title;
  const rawDescription = link.hasPin
    ? "PIN-protected link on cristianarando.dev."
    : link.description?.trim() ||
      (link.type === "HUB"
        ? `Project showcase for ${link.title} on cristianarando.dev.`
        : `Verified short link at cristianarando.dev/${link.slug}.`);

  const canonicalShortUrl = `${baseUrl}/${link.slug}`;
  const rawImage = link.ogImageUrl?.trim() || `${baseUrl}/brand/og-default.png`;

  const title = escapeHtml(rawTitle);
  const description = escapeHtml(rawDescription);
  const ogUrl = escapeHtml(canonicalShortUrl);
  const ogImage = escapeHtml(rawImage);

  const canClientRedirect = !link.hasPin && link.type === "DIRECT" && Boolean(link.destinationUrl);
  const safeDestination = canClientRedirect && link.destinationUrl ? escapeHtml(link.destinationUrl) : "";
  const redirectScript =
    canClientRedirect && link.destinationUrl
      ? `<script>window.location.replace(${JSON.stringify(link.destinationUrl)});</script>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${ogUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="cristianarando.dev" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta property="og:image" content="${ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />
  ${redirectScript}
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fafafa;font-family:system-ui,-apple-system,sans-serif;padding:16px}
    main{max-width:420px;width:100%;border:1px solid #27272a;background:#18181b;border-radius:16px;padding:28px;text-align:center}
    h1{margin:0 0 10px;font-size:20px;font-weight:600}
    p{margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.5}
    a{display:inline-block;padding:10px 18px;border-radius:10px;background:#10b981;color:#052e16;font-weight:600;font-size:13px;text-decoration:none}
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${description}</p>
    ${safeDestination ? `<a href="${safeDestination}">Continue to destination &rarr;</a>` : ""}
  </main>
</body>
</html>`;
}
