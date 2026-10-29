import { after, type NextRequest } from "next/server";
import { renderExpiredLinkHtml } from "@/components/hub/expired-link-view";
import { renderHubLandingHtml } from "@/components/hub/hub-landing-view";
import { renderPinUnlockHtml } from "@/components/hub/pin-unlock-form";
import { resolutionService } from "@/server/services";
import { escapeHtml, getCanonicalBaseUrl, renderOpenGraphHtml } from "@/server/services/og-render.service";
import type { ResolutionService } from "@/server/services/resolution.service";

function renderNotFoundHtml(slug: string): string {
  const baseUrl = escapeHtml(getCanonicalBaseUrl());
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Short link not found — cristianarando.dev</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fafafa;font-family:system-ui,-apple-system,sans-serif;padding:16px}
    .card{max-width:420px;width:100%;border:1px solid #27272a;background:rgba(24,24,27,.75);border-radius:16px;padding:32px;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.5)}
    .badge{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#a1a1aa}
    h1{margin:10px 0 12px;font-size:22px;font-weight:600}
    p{margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa}
    .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    a.btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:12px;font-size:14px;font-weight:500;text-decoration:none}
    a.primary{background:#fafafa;color:#09090b}
    a.secondary{border:1px solid #3f3f46;color:#e4e4e7;background:#18181b}
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">HTTP 404 · Not Found</div>
    <h1>This short link does not exist</h1>
    <p>The route /${escapeHtml(slug)} is not registered on cristianarando.dev.</p>
    <div class="actions">
      <a class="btn primary" href="${baseUrl}">Back to cristianarando.dev</a>
      <a class="btn secondary" href="/links">Browse public links</a>
    </div>
  </main>
</body>
</html>`;
}

function scheduleClickTracking(
  service: ResolutionService,
  payload: { linkId: string; headers: Headers; searchParams: URLSearchParams }
) {
  const task = () => service.recordClickEvent(payload);
  try {
    after(task);
  } catch {
    void task();
  }
}

export async function handleSlugGet(
  request: NextRequest | Request,
  slug: string,
  service: ResolutionService = resolutionService
): Promise<Response> {
  const url = new URL(request.url);
  const result = await service.resolveSlugRequest(slug, {
    headers: request.headers,
    searchParams: url.searchParams,
  });

  switch (result.kind) {
    case "REDIRECT": {
      if (result.shouldTrackClick) {
        scheduleClickTracking(service, {
          linkId: result.linkId,
          headers: request.headers,
          searchParams: url.searchParams,
        });
      }

      const cacheHeader =
        result.status === 301 || result.status === 308
          ? "public, max-age=300, s-maxage=3600"
          : "private, no-store, no-cache, must-revalidate";

      return new Response(null, {
        status: result.status,
        headers: {
          Location: result.location,
          "Cache-Control": cacheHeader,
        },
      });
    }

    case "NOT_FOUND": {
      const html = renderNotFoundHtml(result.slug || slug);
      return new Response(html, {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }

    case "INACTIVE_OR_EXPIRED": {
      const html = renderExpiredLinkHtml({
        reason: result.reason,
        slug: result.slug,
        title: result.title,
      });
      return new Response(html, {
        status: 410,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }

    case "SOCIAL_BOT_OG": {
      const html = renderOpenGraphHtml(result.link);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    case "PIN_REQUIRED": {
      const html = renderPinUnlockHtml({
        slug: result.slug,
        title: result.title,
        description: result.description,
      });
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      });
    }

    case "HUB_VIEW": {
      if (result.shouldTrackClick) {
        scheduleClickTracking(service, {
          linkId: result.linkId,
          headers: request.headers,
          searchParams: url.searchParams,
        });
      }
      const html = renderHubLandingHtml(result.link);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await context.params;
  return handleSlugGet(request, slug);
}
