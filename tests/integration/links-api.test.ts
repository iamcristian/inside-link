import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/server/db/schema";
import { createLinkService } from "@/server/services/link.service";
import {
  handleCreateLinkPost,
  handleListLinksGet,
  type AdminApiDeps,
} from "@/app/api/v1/links/route";
import { handleCheckSlugGet } from "@/app/api/v1/links/check-slug/route";
import {
  handleDeleteLinkDelete,
  handleUpdateLinkPatch,
} from "@/app/api/v1/links/[id]/route";

async function setup() {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON;");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  const service = createLinkService(db);

  const authorizedDeps: AdminApiDeps = {
    service,
    checkAuth: async () => ({
      authorized: true as const,
      session: {
        user: {
          id: "usr_owner",
          name: "Cristian Arando",
          email: "cristian@example.com",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "sess_owner",
          userId: "usr_owner",
          token: "tok_owner",
          expiresAt: new Date(Date.now() + 3600_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    }),
  };

  return { client, db, service, authorizedDeps };
}

describe("Admin Links API Route Handlers (/api/v1/links/*)", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("rejects all unauthenticated requests with 401 Unauthorized", async () => {
    const unauthDeps: AdminApiDeps = { service: ctx.service };

    const getRes = await handleListLinksGet(
      new Request("https://cristianarando.dev/api/v1/links"),
      unauthDeps
    );
    expect(getRes.status).toBe(401);

    const postRes = await handleCreateLinkPost(
      new Request("https://cristianarando.dev/api/v1/links", {
        method: "POST",
        body: JSON.stringify({ title: "Test", destinationUrl: "https://example.com" }),
      }),
      unauthDeps
    );
    expect(postRes.status).toBe(401);

    const checkRes = await handleCheckSlugGet(
      new Request("https://cristianarando.dev/api/v1/links/check-slug?slug=github"),
      unauthDeps
    );
    expect(checkRes.status).toBe(401);

    const patchRes = await handleUpdateLinkPatch(
      new Request("https://cristianarando.dev/api/v1/links/01J00000000000000000000000", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      "01J00000000000000000000000",
      unauthDeps
    );
    expect(patchRes.status).toBe(401);

    const delRes = await handleDeleteLinkDelete(
      new Request("https://cristianarando.dev/api/v1/links/01J00000000000000000000000", {
        method: "DELETE",
      }),
      "01J00000000000000000000000",
      unauthDeps
    );
    expect(delRes.status).toBe(401);
  });

  it("completes the full owner workflow: POST -> check-slug -> GET paginated -> PATCH -> DELETE", async () => {
    // 1. POST crear enlace
    const createRes = await handleCreateLinkPost(
      new Request("https://cristianarando.dev/api/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "Proyecto Guia Turistica",
          title: "Guía Turística",
          type: "DIRECT",
          destinationUrl: "https://github.com/cristianarando/guia-turistica",
          category: "project",
          tags: ["turismo", "nextjs"],
        }),
      }),
      ctx.authorizedDeps
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.slug).toBe("proyecto-guia-turistica");

    // 2. Intentar crear con ruta reservada -> 422 SLUG_RESERVED
    const reservedRes = await handleCreateLinkPost(
      new Request("https://cristianarando.dev/api/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "uses",
          title: "Uses",
          destinationUrl: "https://example.com",
        }),
      }),
      ctx.authorizedDeps
    );
    expect(reservedRes.status).toBe(422);
    const reservedBody = await reservedRes.json();
    expect(reservedBody.error.code).toBe("SLUG_RESERVED");

    // 3. Intentar crear duplicado -> 409 SLUG_ALREADY_EXISTS
    const dupRes = await handleCreateLinkPost(
      new Request("https://cristianarando.dev/api/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "proyecto-guia-turistica",
          title: "Duplicado",
          destinationUrl: "https://example.com",
        }),
      }),
      ctx.authorizedDeps
    );
    expect(dupRes.status).toBe(409);

    // 4. check-slug ocupado, excluido y libre
    const takenCheck = await handleCheckSlugGet(
      new Request(
        "https://cristianarando.dev/api/v1/links/check-slug?slug=proyecto-guia-turistica"
      ),
      ctx.authorizedDeps
    );
    expect(takenCheck.status).toBe(200);
    expect(await takenCheck.json()).toMatchObject({
      available: false,
      reason: "TAKEN",
    });

    const selfCheck = await handleCheckSlugGet(
      new Request(
        `https://cristianarando.dev/api/v1/links/check-slug?slug=proyecto-guia-turistica&excludeId=${created.id}`
      ),
      ctx.authorizedDeps
    );
    expect(await selfCheck.json()).toMatchObject({ available: true });

    const randomSlugRes = await handleCheckSlugGet(
      new Request("https://cristianarando.dev/api/v1/links/check-slug?action=generate"),
      ctx.authorizedDeps
    );
    const randomBody = await randomSlugRes.json();
    expect(randomBody.available).toBe(true);
    expect(randomBody.normalizedSlug).toMatch(/^[a-z0-9]{6}$/);

    // 5. GET paginado con búsqueda
    const listRes = await handleListLinksGet(
      new Request("https://cristianarando.dev/api/v1/links?q=turistica&limit=12"),
      ctx.authorizedDeps
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].id).toBe(created.id);

    // 6. PATCH fijar arriba y cambiar título
    const patchRes = await handleUpdateLinkPatch(
      new Request(`https://cristianarando.dev/api/v1/links/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPinned: true,
          isActive: false,
          title: "Guía Turística v2",
        }),
      }),
      created.id,
      ctx.authorizedDeps
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.isPinned).toBe(true);
    expect(patched.isActive).toBe(false);
    expect(patched.title).toBe("Guía Turística v2");

    // 7. DELETE eliminar enlace
    const delRes = await handleDeleteLinkDelete(
      new Request(`https://cristianarando.dev/api/v1/links/${created.id}`, {
        method: "DELETE",
      }),
      created.id,
      ctx.authorizedDeps
    );
    expect(delRes.status).toBe(200);

    // 8. Segundo DELETE devuelve 404
    const delAgain = await handleDeleteLinkDelete(
      new Request(`https://cristianarando.dev/api/v1/links/${created.id}`, {
        method: "DELETE",
      }),
      created.id,
      ctx.authorizedDeps
    );
    expect(delAgain.status).toBe(404);
  });
});
