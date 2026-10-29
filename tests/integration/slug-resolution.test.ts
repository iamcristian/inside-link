import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { createLinkService } from "@/server/services/link.service";
import { createResolutionService } from "@/server/services/resolution.service";
import { handleSlugGet } from "@/app/(public)/[slug]/route";

async function setup() {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON;");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  return {
    client,
    db,
    linkService: createLinkService(db),
    resolutionService: createResolutionService(db),
  };
}

describe("Slug Resolution Service & GET /[slug] Route Integration", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("resolves active DIRECT links with 307 (default) and 301 (permanent)", async () => {
    await ctx.linkService.createLink({
      slug: "github",
      title: "GitHub",
      type: "DIRECT",
      destinationUrl: "https://github.com/cristianarando",
      redirectStatus: 307,
    });

    await ctx.linkService.createLink({
      slug: "linkedin-perm",
      title: "LinkedIn",
      type: "DIRECT",
      destinationUrl: "https://linkedin.com/in/cristianarando",
      redirectStatus: 301,
    });

    const res307 = await handleSlugGet(
      new Request("https://cristianarando.dev/github", {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0",
          "x-vercel-ip-country": "BO",
          referer: "https://www.linkedin.com/",
        },
      }),
      "github",
      ctx.resolutionService
    );

    expect(res307.status).toBe(307);
    expect(res307.headers.get("Location")).toBe("https://github.com/cristianarando");

    const res301 = await handleSlugGet(
      new Request("https://cristianarando.dev/linkedin-perm"),
      "linkedin-perm",
      ctx.resolutionService
    );

    expect(res301.status).toBe(301);
    expect(res301.headers.get("Location")).toBe("https://linkedin.com/in/cristianarando");
  });

  it("forwards incoming query parameters safely when forwardQueryParams is true and preserves target params", async () => {
    await ctx.linkService.createLink({
      slug: "repo-con-params",
      title: "Repo",
      type: "DIRECT",
      destinationUrl: "https://github.com/cristianarando/inside-link?tab=readme",
      forwardQueryParams: true,
    });

    await ctx.linkService.createLink({
      slug: "repo-sin-params",
      title: "Repo sin params",
      type: "DIRECT",
      destinationUrl: "https://github.com/cristianarando/inside-link",
      forwardQueryParams: false,
    });

    const forwarded = await ctx.resolutionService.resolveSlugRequest("repo-con-params", {
      searchParams: new URLSearchParams("ref=cv&utm_medium=bio&tab=hacked"),
    });

    expect(forwarded.kind).toBe("REDIRECT");
    if (forwarded.kind === "REDIRECT") {
      const targetUrl = new URL(forwarded.location);
      expect(targetUrl.origin + targetUrl.pathname).toBe(
        "https://github.com/cristianarando/inside-link"
      );
      expect(targetUrl.searchParams.get("ref")).toBe("cv");
      expect(targetUrl.searchParams.get("utm_medium")).toBe("bio");
      // Existing param on destinationUrl must NOT be overwritten
      expect(targetUrl.searchParams.get("tab")).toBe("readme");
    }

    const notForwarded = await ctx.resolutionService.resolveSlugRequest("repo-sin-params", {
      searchParams: new URLSearchParams("ref=cv&utm_medium=bio"),
    });

    expect(notForwarded.kind).toBe("REDIRECT");
    if (notForwarded.kind === "REDIRECT") {
      expect(notForwarded.location).toBe("https://github.com/cristianarando/inside-link");
    }
  });

  it("returns 404 NOT_FOUND for unknown, reserved or static-file slugs", async () => {
    const unknown = await handleSlugGet(
      new Request("https://cristianarando.dev/no-existe"),
      "no-existe",
      ctx.resolutionService
    );
    expect(unknown.status).toBe(404);

    const reserved = await ctx.resolutionService.resolveSlugRequest("admin");
    expect(reserved.kind).toBe("NOT_FOUND");

    const staticAsset = await ctx.resolutionService.resolveSlugRequest("favicon.ico");
    expect(staticAsset.kind).toBe("NOT_FOUND");
  });

  it("returns 410 Gone for paused, date-expired or click-exhausted links", async () => {
    await ctx.linkService.createLink({
      slug: "enlace-pausado",
      title: "Pausado",
      type: "DIRECT",
      destinationUrl: "https://example.com",
      isActive: false,
    });

    await ctx.linkService.createLink({
      slug: "enlace-vencido",
      title: "Vencido",
      type: "DIRECT",
      destinationUrl: "https://example.com",
      expiresAt: new Date(Date.now() - 60_000),
    });

    await ctx.linkService.createLink({
      slug: "enlace-un-clic",
      title: "Un solo clic",
      type: "DIRECT",
      destinationUrl: "https://example.com/one-shot",
      maxClicks: 1,
    });

    const pausedRes = await handleSlugGet(
      new Request("https://cristianarando.dev/enlace-pausado"),
      "enlace-pausado",
      ctx.resolutionService
    );
    expect(pausedRes.status).toBe(410);
    expect(pausedRes.headers.get("Location")).toBeNull();

    const expiredRes = await handleSlugGet(
      new Request("https://cristianarando.dev/enlace-vencido"),
      "enlace-vencido",
      ctx.resolutionService
    );
    expect(expiredRes.status).toBe(410);

    // Primer clic humano en enlace con maxClicks = 1: redirige con 307
    const firstClick = await handleSlugGet(
      new Request("https://cristianarando.dev/enlace-un-clic", {
        headers: { "user-agent": "Mozilla/5.0 Chrome/130.0" },
      }),
      "enlace-un-clic",
      ctx.resolutionService
    );
    expect(firstClick.status).toBe(307);

    // Esperar un tick para que el tracking asíncrono termine en memoria
    await new Promise((r) => setTimeout(r, 25));

    // Segundo clic humano: ahora responde 410 Gone porque alcanzó maxClicks = 1
    const secondClick = await handleSlugGet(
      new Request("https://cristianarando.dev/enlace-un-clic", {
        headers: { "user-agent": "Mozilla/5.0 Chrome/130.0" },
      }),
      "enlace-un-clic",
      ctx.resolutionService
    );
    expect(secondClick.status).toBe(410);
  });

  it("excludes prefetch requests and social bots from incrementing clicksCount or exhausting maxClicks", async () => {
    const created = await ctx.linkService.createLink({
      slug: "promo-unica",
      title: "Promo Única",
      description: "Descripción para Open Graph",
      type: "DIRECT",
      destinationUrl: "https://example.com/promo",
      maxClicks: 1,
    });

    // 1. Bot de WhatsApp previsualiza el enlace
    const botRes = await handleSlugGet(
      new Request("https://cristianarando.dev/promo-unica", {
        headers: { "user-agent": "WhatsApp/2.24.1.78 A" },
      }),
      "promo-unica",
      ctx.resolutionService
    );
    expect(botRes.status).toBe(200);
    const botHtml = await botRes.text();
    expect(botHtml).toContain('property="og:title" content="Promo Única"');

    // 2. Navegador hace prefetch del enlace
    const prefetchRes = await handleSlugGet(
      new Request("https://cristianarando.dev/promo-unica", {
        headers: {
          "user-agent": "Mozilla/5.0 Chrome/130.0",
          purpose: "prefetch",
        },
      }),
      "promo-unica",
      ctx.resolutionService
    );
    expect(prefetchRes.status).toBe(307);

    await new Promise((r) => setTimeout(r, 25));

    // Verificar que clicksCount sigue en 0 tras el bot y el prefetch
    const linkBeforeHuman = await ctx.linkService.getLinkById(created.id);
    expect(linkBeforeHuman?.clicksCount).toBe(0);

    // 3. Visitante humano real abre el enlace
    const humanRes = await handleSlugGet(
      new Request("https://cristianarando.dev/promo-unica?ref=whatsapp_chat", {
        headers: {
          "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
          "x-vercel-ip-country": "BO",
        },
      }),
      "promo-unica",
      ctx.resolutionService
    );
    expect(humanRes.status).toBe(307);

    await new Promise((r) => setTimeout(r, 25));

    const linkAfterHuman = await ctx.linkService.getLinkById(created.id);
    expect(linkAfterHuman?.clicksCount).toBe(1);

    const events = await ctx.db
      .select()
      .from(schema.clickEvents)
      .where(eq(schema.clickEvents.linkId, created.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.country).toBe("BO");
    expect(events[0]?.device).toBe("mobile");
    expect(events[0]?.queryParamRef).toBe("whatsapp_chat");
  });
});
