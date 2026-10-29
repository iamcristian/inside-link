import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { NextRequest } from "next/server";
import { handleSlugGet } from "../../src/app/(public)/[slug]/route";
import { GET as listAdminLinksAnonymousGet } from "../../src/app/api/v1/links/route";
import { handleHubSubLinkClickPost } from "../../src/app/api/v1/slug/[slug]/hub-click/route";
import { handlePinUnlockPost } from "../../src/app/api/v1/slug/[slug]/unlock/route";
import * as schema from "../../src/server/db/schema";
import { createAnalyticsService } from "../../src/server/services/analytics.service";
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
    db,
    linkService: createLinkService(db),
    resolutionService: createResolutionService(db),
    analyticsService: createAnalyticsService(db),
  };
}

describe("T-023 E2E (Admin, HUB, PIN y Auditoría de Seguridad/Accesibilidad)", () => {
  it("protege /api/v1/links sin sesión, ejecuta flujo HUB + desbloqueo PIN y audita atributos semánticos/a11y", async () => {
    const { client, db, linkService, resolutionService, analyticsService } =
      await setupE2EEnv();
    try {
      // 1. Petición anónima a /api/v1/links debe ser rechazada con 401
      const anonRes = await listAdminLinksAnonymousGet(
        new NextRequest("https://cristianarando.dev/api/v1/links")
      );
      expect(anonRes.status).toBe(401);

      // 2. Crear Micro-Landing HUB protegida con PIN
      const hub = await linkService.createLink({
        slug: "arquitectura-privada",
        type: "HUB",
        title: "Arquitectura Interna 2026",
        description: "Documentación técnica protegida con PIN.",
        pin: "9876",
        hubLinks: [
          {
            id: "doc-rfc",
            label: "Ver RFC de Diseño",
            url: "https://docs.cristianarando.dev/rfc-2026",
            icon: "file-text",
            variant: "primary",
          },
        ],
      });

      // 3. Visitar /arquitectura-privada muestra vista PIN accesible (role="alert", aria-label) sin filtrar URLs
      const lockedPage = await handleSlugGet(
        new Request("https://cristianarando.dev/arquitectura-privada", {
          headers: { "user-agent": "Mozilla/5.0 Chrome/135.0" },
        }),
        "arquitectura-privada",
        resolutionService
      );
      expect(lockedPage.status).toBe(200);
      const lockedHtml = await lockedPage.text();
      expect(lockedHtml).toContain('aria-label="Access PIN code"');
      expect(lockedHtml).toContain('role="alert"');
      expect(lockedHtml).not.toContain("rfc-2026");

      // 4. Intento de PIN erróneo -> 401, seguido de PIN correcto -> 200 OK con hubLinks
      const failedUnlock = await handlePinUnlockPost(
        new Request("https://cristianarando.dev/api/v1/slug/arquitectura-privada/unlock", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.55" },
          body: JSON.stringify({ pin: "0000" }),
        }),
        "arquitectura-privada",
        { db, resolution: resolutionService }
      );
      expect(failedUnlock.status).toBe(401);

      const okUnlock = await handlePinUnlockPost(
        new Request("https://cristianarando.dev/api/v1/slug/arquitectura-privada/unlock", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "192.0.2.55",
            "user-agent": "Mozilla/5.0 Chrome/135.0",
            "x-vercel-ip-country": "BO",
          },
          body: JSON.stringify({ pin: "9876" }),
        }),
        "arquitectura-privada",
        { db, resolution: resolutionService }
      );
      expect(okUnlock.status).toBe(200);
      const unlockBody = (await okUnlock.json()) as {
        data: { type: string; hubLinks: { id: string; url: string }[] };
      };
      expect(unlockBody.data.type).toBe("HUB");
      expect(unlockBody.data.hubLinks[0]?.url).toBe("https://docs.cristianarando.dev/rfc-2026");

      // 5. Clic en sub-enlace de la HUB y verificación en Analytics
      const subClick = await handleHubSubLinkClickPost(
        new Request("https://cristianarando.dev/api/v1/slug/arquitectura-privada/hub-click", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 Chrome/135.0",
            "x-vercel-ip-country": "BO",
          },
          body: JSON.stringify({ subLinkId: "doc-rfc" }),
        }),
        "arquitectura-privada",
        { db, resolution: resolutionService }
      );
      expect(subClick.status).toBe(200);

      const summary = await analyticsService.getAnalyticsSummary({
        linkId: hub.id,
        range: "7d",
      });
      expect(summary?.totalClicksInRange).toBe(2); // 1 desbloqueo + 1 clic en sub-enlace
    } finally {
      client.close();
    }
  });
});
