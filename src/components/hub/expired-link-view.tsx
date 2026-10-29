import React from "react";
import type { InactiveReason } from "@/server/services/resolution.service";
import { escapeHtml, getCanonicalBaseUrl } from "@/server/services/og-render.service";

export interface ExpiredLinkCopy {
  badge: string;
  heading: string;
  message: string;
}

export function getExpiredLinkCopy(reason: InactiveReason): ExpiredLinkCopy {
  switch (reason) {
    case "EXPIRED":
      return {
        badge: "HTTP 410 · Link Expired",
        heading: "This link has expired",
        message: "The validity period configured for this short link has ended.",
      };
    case "MAX_CLICKS_REACHED":
      return {
        badge: "HTTP 410 · Limit Reached",
        heading: "Maximum click limit reached",
        message: "This temporary link has reached the maximum number of allowed clicks.",
      };
    case "INACTIVE":
    default:
      return {
        badge: "HTTP 410 · Link Inactive",
        heading: "This link is currently paused",
        message: "The owner has temporarily disabled this short link.",
      };
  }
}

export function renderExpiredLinkHtml(params: {
  reason: InactiveReason;
  slug: string;
  title?: string;
}): string {
  const copy = getExpiredLinkCopy(params.reason);
  const baseUrl = escapeHtml(getCanonicalBaseUrl());

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(copy.heading)} — cristianarando.dev</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fafafa;font-family:system-ui,-apple-system,sans-serif;padding:16px}
    .card{max-width:440px;width:100%;border:1px solid #27272a;background:rgba(24,24,27,.85);border-radius:18px;padding:32px;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.5)}
    .badge{display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.1);font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#fcd34d}
    h1{margin:14px 0 10px;font-size:22px;font-weight:600}
    .slug{font-family:ui-monospace,monospace;font-size:12px;color:#71717a;margin-bottom:12px}
    p{margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa}
    .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    a.btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:12px;font-size:14px;font-weight:500;text-decoration:none}
    a.primary{background:#fafafa;color:#09090b}
    a.secondary{border:1px solid #3f3f46;color:#e4e4e7;background:#18181b}
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">${escapeHtml(copy.badge)}</span>
    <h1>${escapeHtml(copy.heading)}</h1>
    <div class="slug">/${escapeHtml(params.slug)}</div>
    <p>${escapeHtml(copy.message)}</p>
    <div class="actions">
      <a class="btn primary" href="${baseUrl}">Go to cristianarando.dev</a>
      <a class="btn secondary" href="/links">Browse /links</a>
    </div>
  </main>
</body>
</html>`;
}

export function ExpiredLinkView({
  reason,
  slug,
}: {
  reason: InactiveReason;
  slug: string;
}) {
  const copy = getExpiredLinkCopy(reason);
  const baseUrl = getCanonicalBaseUrl();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 text-center shadow-2xl">
        <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-amber-300">
          {copy.badge}
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{copy.heading}</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">/{slug}</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{copy.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={baseUrl}
            className="inline-flex items-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-white"
          >
            Go to cristianarando.dev
          </a>
          <a
            href="/links"
            className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Browse /links
          </a>
        </div>
      </div>
    </main>
  );
}
