import React from "react";
import type { LinkDTO } from "@/lib/types/link-dto";
import { escapeHtml, getCanonicalBaseUrl } from "@/server/services/og-render.service";

export function renderHubLandingHtml(link: LinkDTO): string {
  const baseUrl = escapeHtml(getCanonicalBaseUrl());
  const title = escapeHtml(link.title);
  const description = escapeHtml(
    link.description || "Official project links and resources."
  );
  const slug = escapeHtml(link.slug);

  const tagsHtml =
    link.tags.length > 0
      ? `<div class="tags">${link.tags
          .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
          .join("")}</div>`
      : "";

  const buttonsHtml = (link.hubLinks ?? [])
    .map((item) => {
      const variantClass =
        item.variant === "primary"
          ? "btn primary"
          : item.variant === "secondary"
            ? "btn secondary"
            : "btn outline";
      return `<a
        class="${variantClass}"
        href="${escapeHtml(item.url)}"
        data-sub-link-id="${escapeHtml(item.id)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>${escapeHtml(item.label)}</span>
        <span class="arrow" aria-hidden="true">↗</span>
      </a>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — cristianarando.dev</title>
  <meta name="description" content="${description}" />
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at top,#18181b 0%,#09090b 65%);color:#fafafa;font-family:system-ui,-apple-system,sans-serif;padding:24px 16px}
    .card{max-width:480px;width:100%;border:1px solid #27272a;background:rgba(24,24,27,.82);backdrop-filter:blur(12px);border-radius:20px;padding:32px;box-shadow:0 24px 48px rgba(0,0,0,.55)}
    .eyebrow{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid rgba(16,185,129,.3);background:rgba(16,185,129,.1);color:#6ee7b7;font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
    h1{margin:14px 0 8px;font-size:24px;font-weight:600;letter-spacing:-.02em}
    p.desc{margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa}
    .tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:22px}
    .tag{padding:3px 9px;border-radius:8px;background:#18181b;border:1px solid #27272a;font-family:ui-monospace,monospace;font-size:11px;color:#a1a1aa}
    .links{display:flex;flex-direction:column;gap:10px}
    a.btn{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-radius:12px;font-size:14px;font-weight:500;text-decoration:none;transition:transform .12s ease,background .15s ease}
    a.btn:hover{transform:translateY(-1px)}
    a.primary{background:#fafafa;color:#09090b}
    a.secondary{background:#27272a;color:#fafafa;border:1px solid #3f3f46}
    a.outline{background:transparent;color:#e4e4e7;border:1px solid #3f3f46}
    .arrow{font-size:13px;opacity:.75}
    footer{margin-top:24px;padding-top:16px;border-top:1px solid #27272a;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#71717a}
    footer a{color:#a1a1aa;text-decoration:none}
    footer a:hover{color:#fafafa}
  </style>
</head>
<body>
  <main class="card" data-hub-slug="${slug}">
    <span class="eyebrow">Project · HUB</span>
    <h1>${title}</h1>
    <p class="desc">${description}</p>
    ${tagsHtml}
    <div class="links">
      ${buttonsHtml}
    </div>
    <footer>
      <a href="${baseUrl}">cristianarando.dev</a>
      <a href="/links">Browse all links →</a>
    </footer>
  </main>
  <script>
    (function(){
      var main = document.querySelector('[data-hub-slug]');
      if (!main) return;
      var slug = main.getAttribute('data-hub-slug');
      var links = main.querySelectorAll('a[data-sub-link-id]');
      links.forEach(function(anchor){
        anchor.addEventListener('click', function(){
          var subLinkId = anchor.getAttribute('data-sub-link-id');
          if (!subLinkId || !slug) return;
          var url = '/api/v1/slug/' + encodeURIComponent(slug) + '/hub-click';
          var payload = JSON.stringify({ subLinkId: subLinkId });
          if (navigator.sendBeacon) {
            var blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
          } else {
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function(){});
          }
        });
      });
    })();
  </script>
</body>
</html>`;
}

export function HubLandingView({ link }: { link: LinkDTO }) {
  const baseUrl = getCanonicalBaseUrl();

  const handleSubLinkClick = (subLinkId: string) => {
    const url = `/api/v1/slug/${encodeURIComponent(link.slug)}/hub-click`;
    const body = JSON.stringify({ subLinkId });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-50">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl">
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-emerald-300">
          Project · HUB
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{link.title}</h1>
        {link.description ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{link.description}</p>
        ) : null}

        {link.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {link.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 font-mono text-xs text-zinc-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5">
          {(link.hubLinks ?? []).map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleSubLinkClick(item.id)}
              className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white"
            >
              <span>{item.label}</span>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>

        <footer className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-500">
          <a href={baseUrl} className="hover:text-zinc-300">
            cristianarando.dev
          </a>
          <a href="/links" className="hover:text-zinc-300">
            Browse all links →
          </a>
        </footer>
      </div>
    </main>
  );
}
