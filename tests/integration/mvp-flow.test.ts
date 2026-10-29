import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/server/db/schema";
import { createLinkService } from "@/server/services/link.service";
import { createResolutionService } from "@/server/services/resolution.service";
import {
  handleCreateLinkPost,
  handleListLinksGet,
  type AdminApiDeps,
} from "@/app/api/v1/links/route";
import { handleUpdateLinkPatch } from "@/app/api/v1/links/[id]/route";
import { handleSlugGet } from "@/app/(public)/[slug]/route";
import { sortLinksByKeyset } from "@/components/admin/infinite-link-grid";
import type { LinkDTO } from "@/lib/types/link-dto";

describe("Phase P1 Gate — End-to-End MVP Flow Integration", () => {
  let service: ReturnType<typeof createLinkService>;
  let resolution: ReturnType<typeof createResolutionService>;
  let adminDeps: AdminApiDeps;

  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    await client.execute("PRAGMA foreign_keys = ON;");
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/server/db/migrations" });

    service = createLinkService(db);
    resolution = createResolutionService(db);
    adminDeps = {
      service,
      checkAuth: async () => ({
        authorized: true as const,
        session: {
          user: {
            id: "owner_1",
            name: "Cristian Arando",
            email: "cristian@example.com",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          session: {
            id: "sess_1",
            userId: "owner_1",
            token: "tok_1",
            expiresAt: new Date(Date.now() + 3600_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }),
    };
  });

  it("executes the complete P1 MVP lifecycle: create -> list -> pin -> redirect + telemetry -> pause -> block", async () => {
    // 1. Crear dos enlaces mediante el endpoint POST /api/v1/links
    const res1 = await handleCreateLinkPost(
      new Request("https://cristianarando.dev/api/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "primer-enlace",
          title: "Primer Enlace",
          destinationUrl: "https://github.com/cristianarando/one",
        }),
      }),
      adminDeps
    );
    expect(res1.status).toBe(201);
    const link1 = (await res1.json()) as LinkDTO;

    const res2 = await handleCreateLinkPost(
      new Request("https://cristianarando.dev/api/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "segundo-enlace",
          title: "Segundo Enlace",
          destinationUrl: "https://github.com/cristianarando/two",
        }),
      }),
      adminDeps
    );
    expect(res2.status).toBe(201);
    const link2 = (await res2.json()) as LinkDTO;

    // 2. Listar en primera página por cursor (orden descendente por ULID: segundo-enlace primero)
    const listBeforePin = await handleListLinksGet(
      new Request("https://cristianarando.dev/api/v1/links?limit=12"),
      adminDeps
    );
    const pageBefore = await listBeforePin.json();
    expect(pageBefore.items.map((l: LinkDTO) => l.slug)).toEqual([
      "segundo-enlace",
      "primer-enlace",
    ]);

    // 3. Fijar arriba `primer-enlace` (isPinned = true) y verificar reordenamiento tanto en cliente como en servidor
    const pinRes = await handleUpdateLinkPatch(
      new Request(`https://cristianarando.dev/api/v1/links/${link1.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: true }),
      }),
      link1.id,
      adminDeps
    );
    expect(pinRes.status).toBe(200);
    const pinnedLink1 = (await pinRes.json()) as LinkDTO;

    const clientSorted = sortLinksByKeyset([link2, pinnedLink1]);
    expect(clientSorted.map((l) => l.slug)).toEqual([
      "primer-enlace",
      "segundo-enlace",
    ]);

    const listAfterPin = await handleListLinksGet(
      new Request("https://cristianarando.dev/api/v1/links?limit=12"),
      adminDeps
    );
    const pageAfter = await listAfterPin.json();
    expect(pageAfter.items.map((l: LinkDTO) => l.slug)).toEqual([
      "primer-enlace",
      "segundo-enlace",
    ]);

    // 4. Resolver GET /primer-enlace?ref=cv verificando redirección 307 y conteo de clic
    const redirectRes = await handleSlugGet(
      new Request("https://cristianarando.dev/primer-enlace?ref=cv", {
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130.0",
          "x-vercel-ip-country": "BO",
        },
      }),
      "primer-enlace",
      resolution
    );
    expect(redirectRes.status).toBe(307);
    expect(redirectRes.headers.get("Location")).toBe(
      "https://github.com/cristianarando/one?ref=cv"
    );

    await new Promise((r) => setTimeout(r, 25));

    const updatedLink1 = await service.getLinkById(link1.id);
    expect(updatedLink1?.clicksCount).toBe(1);

    // 5. Pausar enlace (isActive = false) y verificar que GET /primer-enlace devuelve 410 Gone
    const pauseRes = await handleUpdateLinkPatch(
      new Request(`https://cristianarando.dev/api/v1/links/${link1.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      link1.id,
      adminDeps
    );
    expect(pauseRes.status).toBe(200);

    const blockedRes = await handleSlugGet(
      new Request("https://cristianarando.dev/primer-enlace"),
      "primer-enlace",
      resolution
    );
    expect(blockedRes.status).toBe(410);
    expect(blockedRes.headers.get("Location")).toBeNull();
  });
});
