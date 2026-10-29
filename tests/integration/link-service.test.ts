import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { createLinkService, LinkServiceError, type LinkService } from "@/server/services/link.service";
import { verifyPin } from "@/server/crypto/pin";
import type { LinkDTO } from "@/lib/types/link-dto";

async function setup() {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON;");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  return { client, db, service: createLinkService(db) };
}

async function expectServiceError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(LinkServiceError);
  expect((err as LinkServiceError).code).toBe(code);
}

function direct(slug: string, extra: Record<string, unknown> = {}) {
  return { slug, title: `Link ${slug}`, type: "DIRECT", destinationUrl: `https://example.com/${slug}`, ...extra };
}

/** Recorre todas las páginas siguiendo nextCursor. */
async function collectAll(service: LinkService, params: Record<string, unknown> = {}) {
  const pages: LinkDTO[][] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 20; guard++) {
    const page = await service.listLinksPaginated({ ...params, cursor, limit: 12 });
    pages.push(page.items);
    if (!page.hasNextPage) {
      expect(page.nextCursor).toBeNull();
      break;
    }
    cursor = page.nextCursor;
  }
  return pages;
}

describe("LinkService — CRUD & slug rules", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("creates a DIRECT link, normalizing the slug and returning a safe DTO", async () => {
    const link = await ctx.service.createLink(direct("  Mi Guía Turística  "));
    expect(link.slug).toBe("mi-guia-turistica");
    expect(link.shortUrl).toBe("https://cristianarando.dev/mi-guia-turistica");
    expect(link.type).toBe("DIRECT");
    expect(link.redirectStatus).toBe(307);
    expect(link.hasPin).toBe(false);
    expect(link).not.toHaveProperty("passwordHash");
    expect(link.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("rejects reserved slugs with SLUG_RESERVED (incl. file-like slugs)", async () => {
    await expectServiceError(ctx.service.createLink(direct("admin")), "SLUG_RESERVED");
    await expectServiceError(ctx.service.createLink(direct("cv")), "SLUG_RESERVED");
    await expectServiceError(ctx.service.createLink(direct("es")), "SLUG_RESERVED");
    await expectServiceError(ctx.service.createLink(direct("favicon.ico")), "SLUG_RESERVED");
  });

  it("rejects syntactically invalid slugs with VALIDATION_ERROR", async () => {
    await expectServiceError(ctx.service.createLink(direct("my.page")), "VALIDATION_ERROR");
    await expectServiceError(ctx.service.createLink(direct("x1")), "VALIDATION_ERROR");
  });

  it("rejects duplicate slugs with SLUG_ALREADY_EXISTS", async () => {
    await ctx.service.createLink(direct("github"));
    await expectServiceError(ctx.service.createLink(direct("GitHub")), "SLUG_ALREADY_EXISTS");
  });

  it("auto-generates a unique 6-char slug when none is provided", async () => {
    const link = await ctx.service.createLink({ title: "Auto", destinationUrl: "https://example.com" });
    expect(link.slug).toMatch(/^[a-z0-9]{6}$/);
  });

  it("rejects unsafe destination URLs", async () => {
    await expectServiceError(
      ctx.service.createLink(direct("xss-test", { destinationUrl: "javascript:alert(1)" })),
      "VALIDATION_ERROR"
    );
  });

  it("creates a HUB link and round-trips its sub-links", async () => {
    const link = await ctx.service.createLink({
      slug: "proyecto-hub",
      title: "Proyecto HUB",
      type: "HUB",
      destinationUrl: "https://ignored.example.com",
      hubLinks: [{ id: "repo", label: "GitHub", url: "https://github.com/x/y", icon: "github" }],
    });
    expect(link.type).toBe("HUB");
    expect(link.destinationUrl).toBeNull();
    expect(link.hubLinks).toEqual([
      { id: "repo", label: "GitHub", url: "https://github.com/x/y", icon: "github", variant: "primary" },
    ]);
  });

  it("hashes PINs with scrypt and never exposes the hash", async () => {
    const link = await ctx.service.createLink(direct("protegido", { pin: "1234" }));
    expect(link.hasPin).toBe(true);
    const row = await ctx.service.findRowById(link.id);
    expect(row?.passwordHash?.startsWith("v1:")).toBe(true);
    expect(verifyPin("1234", row!.passwordHash!)).toBe(true);
  });

  it("updates fields, rejects taken slugs and enforces the final-state polymorphic invariant", async () => {
    const a = await ctx.service.createLink(direct("enlace-a"));
    await ctx.service.createLink(direct("enlace-b"));

    const renamed = await ctx.service.updateLink(a.id, { slug: "Enlace Renombrado", title: "Nuevo título" });
    expect(renamed.slug).toBe("enlace-renombrado");
    expect(renamed.title).toBe("Nuevo título");

    // Mismo slug propio: permitido.
    await expect(ctx.service.updateLink(a.id, { slug: "enlace-renombrado" })).resolves.toBeDefined();
    await expectServiceError(ctx.service.updateLink(a.id, { slug: "enlace-b" }), "SLUG_ALREADY_EXISTS");
    await expectServiceError(ctx.service.updateLink(a.id, { slug: "admin" }), "SLUG_RESERVED");
    await expectServiceError(ctx.service.updateLink(a.id, { type: "HUB" }), "VALIDATION_ERROR");
    await expectServiceError(ctx.service.updateLink(a.id, { destinationUrl: null }), "VALIDATION_ERROR");
    await expectServiceError(ctx.service.updateLink("01JXXXXXXXXXXXXXXXXXXXXXXX", { title: "x" }), "NOT_FOUND");
  });

  it("sets, rotates and clears PIN protection through updates", async () => {
    const link = await ctx.service.createLink(direct("pin-cycle"));
    expect((await ctx.service.updateLink(link.id, { pin: "9999" })).hasPin).toBe(true);
    expect((await ctx.service.updateLink(link.id, { title: "otro" })).hasPin).toBe(true);
    expect((await ctx.service.updateLink(link.id, { pin: null })).hasPin).toBe(false);
  });

  it("toggles quick-action flags", async () => {
    const link = await ctx.service.createLink(direct("toggle-me"));
    const toggled = await ctx.service.toggleLinkFlags(link.id, { isActive: false, isPinned: true, isPublic: true });
    expect(toggled).toMatchObject({ isActive: false, isPinned: true, isPublic: true });
  });

  it("deletes links and reports NOT_FOUND afterwards", async () => {
    const link = await ctx.service.createLink(direct("borrar"));
    await ctx.service.deleteLink(link.id);
    expect(await ctx.service.getLinkById(link.id)).toBeNull();
    await expectServiceError(ctx.service.deleteLink(link.id), "NOT_FOUND");
  });

  it("reports slug availability with reasons", async () => {
    const link = await ctx.service.createLink(direct("ocupado"));
    expect(await ctx.service.checkSlugAvailability("libre-total")).toEqual({
      available: true,
      normalizedSlug: "libre-total",
    });
    expect(await ctx.service.checkSlugAvailability("Ocupado")).toMatchObject({ available: false, reason: "TAKEN" });
    expect(await ctx.service.checkSlugAvailability("ocupado", link.id)).toMatchObject({ available: true });
    expect(await ctx.service.checkSlugAvailability("uses")).toMatchObject({ available: false, reason: "RESERVED" });
    expect(await ctx.service.checkSlugAvailability("my.page")).toMatchObject({ available: false, reason: "INVALID" });
  });
});

describe("LinkService — keyset pagination over (is_pinned DESC, id DESC)", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    ctx = await setup();
    // 30 enlaces: los índices múltiplos de 6 quedan fijados (0,6,12,18,24 => 5 fijados).
    for (let i = 0; i < 30; i++) {
      await ctx.service.createLink(direct(`link-${String(i).padStart(2, "0")}`, { isPinned: i % 6 === 0 }));
    }
  });

  it("walks 3 pages (12+12+6) without duplicates or gaps, pinned first", async () => {
    const pages = await collectAll(ctx.service);
    expect(pages.map((p) => p.length)).toEqual([12, 12, 6]);

    const all = pages.flat();
    expect(new Set(all.map((l) => l.id)).size).toBe(30);
    expect(all.slice(0, 5).every((l) => l.isPinned)).toBe(true);
    expect(all.slice(5).every((l) => !l.isPinned)).toBe(true);

    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1]!;
      const curr = all[i]!;
      const prevKey = `${prev.isPinned ? 1 : 0}:${prev.id}`;
      const currKey = `${curr.isPinned ? 1 : 0}:${curr.id}`;
      expect(prevKey > currKey).toBe(true);
    }
  });

  it("remains stable when a link is created between page requests", async () => {
    const first = await ctx.service.listLinksPaginated({ limit: 12 });
    await ctx.service.createLink(direct("insertado-en-medio"));
    const second = await ctx.service.listLinksPaginated({ limit: 12, cursor: first.nextCursor });
    const third = await ctx.service.listLinksPaginated({ limit: 12, cursor: second.nextCursor });

    const seen = [...first.items, ...second.items, ...third.items].map((l) => l.slug);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(30);
    expect(seen).not.toContain("insertado-en-medio");
  });

  it("clamps the page size to the [1, 50] range", async () => {
    expect((await ctx.service.listLinksPaginated({ limit: 500 })).items).toHaveLength(30);
    expect((await ctx.service.listLinksPaginated({ limit: 0 })).items).toHaveLength(1);
  });

  it("rejects corrupted cursors with a controlled VALIDATION_ERROR", async () => {
    await expectServiceError(ctx.service.listLinksPaginated({ cursor: "not-a-cursor" }), "VALIDATION_ERROR");
  });
});

describe("LinkService — search, filters and public isolation", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    ctx = await setup();
  });

  it("searches slug, title, description and destination case-insensitively, treating wildcards literally", async () => {
    await ctx.service.createLink(direct("guia-turistica", { title: "Guía Turística" }));
    await ctx.service.createLink(direct("otro", { title: "Otro", description: "Recorrido por la GUIA local" }));
    await ctx.service.createLink(direct("repo", { destinationUrl: "https://github.com/guia/repo" }));
    await ctx.service.createLink(direct("sin-match", { title: "100% real" }));

    const result = await ctx.service.listLinksPaginated({ q: "GUIA" });
    expect(result.items.map((l) => l.slug).sort()).toEqual(["guia-turistica", "otro", "repo"]);

    const wildcard = await ctx.service.listLinksPaginated({ q: "%" });
    expect(wildcard.items.map((l) => l.slug)).toEqual(["sin-match"]);
  });

  it("filters by category and by status", async () => {
    const now = new Date();
    await ctx.service.createLink(direct("social-a", { category: "social" }));
    await ctx.service.createLink(direct("pausado", { isActive: false }));
    await ctx.service.createLink(direct("fijado", { isPinned: true }));
    await ctx.service.createLink(direct("vencido", { expiresAt: new Date(now.getTime() - 60_000) }));
    const agotado = await ctx.service.createLink(direct("agotado", { maxClicks: 3 }));
    await ctx.db.update(schema.links).set({ clicksCount: 3 }).where(eq(schema.links.id, agotado.id));

    const slugs = async (params: Record<string, unknown>) =>
      (await ctx.service.listLinksPaginated(params)).items.map((l) => l.slug).sort();

    expect(await slugs({ category: "social" })).toEqual(["social-a"]);
    expect(await slugs({ status: "inactive" })).toEqual(["pausado"]);
    expect(await slugs({ status: "pinned" })).toEqual(["fijado"]);
    expect(await slugs({ status: "expired" })).toEqual(["agotado", "vencido"]);
    expect(await slugs({ status: "active" })).toEqual(["fijado", "social-a"]);

    const expired = (await ctx.service.listLinksPaginated({ status: "expired" })).items;
    expect(expired.every((l) => l.isExpired)).toBe(true);

    await expectServiceError(ctx.service.listLinksPaginated({ category: "nope" }), "VALIDATION_ERROR");
    await expectServiceError(ctx.service.listLinksPaginated({ status: "nope" }), "VALIDATION_ERROR");
  });

  it("public listing only returns public, active, non-expired links with a reduced DTO", async () => {
    await ctx.service.createLink(direct("publico", { isPublic: true }));
    await ctx.service.createLink(direct("privado", { isPublic: false }));
    await ctx.service.createLink(direct("publico-pausado", { isPublic: true, isActive: false }));
    await ctx.service.createLink(
      direct("publico-vencido", { isPublic: true, expiresAt: new Date(Date.now() - 1000) })
    );

    const result = await ctx.service.listPublicLinksPaginated({});
    expect(result.items.map((l) => l.slug)).toEqual(["publico"]);
    const item = result.items[0]!;
    expect(item).not.toHaveProperty("destinationUrl");
    expect(item).not.toHaveProperty("maxClicks");
    expect(item).not.toHaveProperty("clicksCount");
    expect(item).not.toHaveProperty("passwordHash");
  });
});
