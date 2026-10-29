import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { handleSlugGet } from "../../src/app/(public)/[slug]/route";
import { handlePinUnlockPost } from "../../src/app/api/v1/slug/[slug]/unlock/route";
import * as schema from "../../src/server/db/schema";
import { createLinkService } from "../../src/server/services/link.service";
import { createResolutionService } from "../../src/server/services/resolution.service";

async function setupEnv() {
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
  };
}

describe("T-016: Protección con PIN y Rate Limiting (scrypt + Intersticial)", () => {
  it("no filtra destination_url en GET inicial, bloquea con 429 tras 5 fallos y desbloquea con PIN válido", async () => {
    const { client, db, linkService, resolutionService } = await setupEnv();
    try {
      const secretDestination = "https://docs.cristianarando.dev/private-budget-2026-xyz";
      await linkService.createLink({
        slug: "presupuesto-cliente",
        type: "DIRECT",
        destinationUrl: secretDestination,
        title: "Presupuesto Confidencial",
        pin: "2026",
        isPublic: false,
      });

      // 1. GET inicial devuelve 200 OK con formulario PIN y JAMÁS expone secretDestination
      const initialGet = await handleSlugGet(
        new Request("https://cristianarando.dev/presupuesto-cliente", {
          headers: { "user-agent": "Mozilla/5.0 Chrome/135.0" },
        }),
        "presupuesto-cliente",
        resolutionService
      );
      expect(initialGet.status).toBe(200);
      expect(initialGet.headers.get("location")).toBeNull();
      const html = await initialGet.text();
      expect(html).toContain("PIN Protected Link");
      expect(html).not.toContain(secretDestination);
      expect(html).not.toContain("private-budget-2026-xyz");

      // 2. Enviar 5 intentos fallidos desde la misma IP -> 401 Unauthorized
      for (let attempt = 1; attempt <= 5; attempt++) {
        const wrongRes = await handlePinUnlockPost(
          new Request("https://cristianarando.dev/api/v1/slug/presupuesto-cliente/unlock", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": "198.51.100.42",
              "user-agent": "Mozilla/5.0 Chrome/135.0",
            },
            body: JSON.stringify({ pin: `000${attempt}` }),
          }),
          "presupuesto-cliente",
          { db, resolution: resolutionService }
        );
        expect(wrongRes.status).toBe(401);
      }

      // 3. El 6.º intento dentro de la ventana de 60s recibe 429 Too Many Requests
      const sixthRes = await handlePinUnlockPost(
        new Request("https://cristianarando.dev/api/v1/slug/presupuesto-cliente/unlock", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "198.51.100.42",
            "user-agent": "Mozilla/5.0 Chrome/135.0",
          },
          body: JSON.stringify({ pin: "2026" }),
        }),
        "presupuesto-cliente",
        { db, resolution: resolutionService }
      );
      expect(sixthRes.status).toBe(429);

      // 4. Desde otro cliente (o tras expirar ventana), enviar el PIN correcto devuelve 200 OK e incrementa clicks_count
      const validRes = await handlePinUnlockPost(
        new Request("https://cristianarando.dev/api/v1/slug/presupuesto-cliente/unlock", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "198.51.100.99",
            "user-agent": "Mozilla/5.0 Chrome/135.0",
          },
          body: JSON.stringify({ pin: "2026" }),
        }),
        "presupuesto-cliente",
        { db, resolution: resolutionService }
      );

      expect(validRes.status).toBe(200);
      const payload = (await validRes.json()) as {
        data: { destinationUrl: string; type: string };
      };
      expect(payload.data.destinationUrl).toBe(secretDestination);

      const updated = await linkService.getLinkBySlug("presupuesto-cliente");
      expect(updated?.clicksCount).toBe(1);
    } finally {
      client.close();
    }
  });
});
