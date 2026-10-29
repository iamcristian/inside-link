import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { handleSlugGet } from "../../src/app/(public)/[slug]/route";
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
    linkService: createLinkService(db),
    resolutionService: createResolutionService(db),
  };
}

describe("T-014: Inyección Dinámica de Open Graph para Bots de Redes Sociales", () => {
  it("devuelve 200 OK con meta tags Open Graph ante WhatsApp/LinkedInBot sin consumir max_clicks", async () => {
    const { client, linkService, resolutionService } = await setupEnv();
    try {
      await linkService.createLink({
        slug: "charla-exclusiva",
        type: "DIRECT",
        destinationUrl: "https://example.com/secret-stream",
        title: "Charla de Arquitectura Edge",
        description: "Sesión en vivo sobre Next.js 16 y Turso",
        ogImageUrl: "https://cristianarando.dev/og/charla.png",
        maxClicks: 1,
      });

      // 1. Petición de WhatsApp Bot
      const whatsappRes = await handleSlugGet(
        new Request("https://cristianarando.dev/charla-exclusiva", {
          headers: { "user-agent": "WhatsApp/2.24.1 i" },
        }),
        "charla-exclusiva",
        resolutionService
      );

      expect(whatsappRes.status).toBe(200);
      expect(whatsappRes.headers.get("content-type")).toContain("text/html");
      const html = await whatsappRes.text();
      expect(html).toContain('property="og:title" content="Charla de Arquitectura Edge"');
      expect(html).toContain('property="og:description" content="Sesión en vivo sobre Next.js 16 y Turso"');
      expect(html).toContain('property="og:image" content="https://cristianarando.dev/og/charla.png"');
      expect(html).toContain('name="twitter:card" content="summary_large_image"');

      // 2. Petición de LinkedInBot
      const linkedinRes = await handleSlugGet(
        new Request("https://cristianarando.dev/charla-exclusiva", {
          headers: { "user-agent": "LinkedInBot/1.0 (compatible; Mozilla/5.0)" },
        }),
        "charla-exclusiva",
        resolutionService
      );
      expect(linkedinRes.status).toBe(200);

      // Verificar que clicks_count sigue en 0 y el visitante humano aún puede usar su único clic
      const beforeHuman = await linkService.getLinkBySlug("charla-exclusiva");
      expect(beforeHuman?.clicksCount).toBe(0);

      const humanRes = await handleSlugGet(
        new Request("https://cristianarando.dev/charla-exclusiva", {
          headers: { "user-agent": "Mozilla/5.0 Chrome/135.0" },
        }),
        "charla-exclusiva",
        resolutionService
      );
      expect(humanRes.status).toBe(307);
      expect(humanRes.headers.get("location")).toBe("https://example.com/secret-stream");
    } finally {
      client.close();
    }
  });
});
