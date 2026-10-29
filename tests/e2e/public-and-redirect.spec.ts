import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { handleSlugGet } from "../../src/app/(public)/[slug]/route";
import { handleListPublicLinksGet } from "../../src/app/api/v1/links/public/route";
import type { PaginatedResult, PublicLinkDTO } from "../../src/lib/types/link-dto";
import * as schema from "../../src/server/db/schema";
import { createLinkService } from "../../src/server/services/link.service";
import { createResolutionService } from "../../src/server/services/resolution.service";

async function setupE2EEnv() {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON;");
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "src/server/db/migrations"),
  });
  return {
    client,
    linkService: createLinkService(db),
    resolutionService: createResolutionService(db),
  };
}

describe("T-023 E2E (Público y Redirección): /[slug], Open Graph y /links con Infinite Scroll", () => {
  it("ejecuta el flujo E2E de redirección directa con query params, preview de WhatsApp y paginación pública en /links", async () => {
    const { client, linkService, resolutionService } = await setupE2EEnv();
    try {
      // 1. Semillar 15 enlaces públicos para probar Infinite Scroll en /links
      for (let i = 1; i <= 15; i++) {
        await linkService.createLink({
          slug: `recurso-dev-${String(i).padStart(2, "0")}`,
          type: "DIRECT",
          destinationUrl: `https://cristianarando.dev/blog/post-${i}?lang=es`,
          title: `Recurso de Ingeniería #${i}`,
          description: `Guía técnica número ${i}`,
          category: i <= 8 ? "project" : "resource",
          isPublic: true,
          isPinned: i === 15,
          forwardQueryParams: true,
        });
      }

      // 2. Redirección directa preservando query params entrantes sin sobrescribir lang=es
      const redirectRes = await handleSlugGet(
        new Request(
          "https://cristianarando.dev/recurso-dev-01?utm_source=linkedin&lang=en",
          { headers: { "user-agent": "Mozilla/5.0 Chrome/135.0" } }
        ),
        "recurso-dev-01",
        resolutionService
      );
      expect(redirectRes.status).toBe(307);
      expect(redirectRes.headers.get("location")).toBe(
        "https://cristianarando.dev/blog/post-1?lang=es&utm_source=linkedin"
      );

      // 3. Simulación de bot WhatsApp/2.0 -> 200 OK con Open Graph
      const botRes = await handleSlugGet(
        new Request("https://cristianarando.dev/recurso-dev-02", {
          headers: { "user-agent": "WhatsApp/2.24.1 A" },
        }),
        "recurso-dev-02",
        resolutionService
      );
      expect(botRes.status).toBe(200);
      const ogHtml = await botRes.text();
      expect(ogHtml).toContain('property="og:title"');
      expect(ogHtml).toContain("Recurso de Ingeniería #2");

      // 4. Navegación en /links: lote inicial (12 ítems) + siguiente página por cursor (3 ítems)
      const firstPageRes = await handleListPublicLinksGet(
        new Request("https://cristianarando.dev/api/v1/links/public?limit=12"),
        linkService
      );
      const firstPage = (await firstPageRes.json()) as PaginatedResult<PublicLinkDTO>;
      expect(firstPage.items).toHaveLength(12);
      expect(firstPage.items[0]?.slug).toBe("recurso-dev-15"); // fijado arriba
      expect(firstPage.hasNextPage).toBe(true);
      expect(firstPage.nextCursor).toBeTruthy();

      const secondPageRes = await handleListPublicLinksGet(
        new Request(
          `https://cristianarando.dev/api/v1/links/public?limit=12&cursor=${encodeURIComponent(
            firstPage.nextCursor!
          )}`
        ),
        linkService
      );
      const secondPage = (await secondPageRes.json()) as PaginatedResult<PublicLinkDTO>;
      expect(secondPage.items).toHaveLength(3);
      expect(secondPage.hasNextPage).toBe(false);
    } finally {
      client.close();
    }
  });
});
