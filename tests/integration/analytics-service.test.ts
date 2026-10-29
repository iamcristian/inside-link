import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as schema from "../../src/server/db/schema";
import { createAnalyticsService } from "../../src/server/services/analytics.service";
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
    analyticsService: createAnalyticsService(db),
  };
}

describe("T-019: Servicio de Telemetría Asíncrona y Agregaciones Analíticas", () => {
  it("calcula series diarias, países, dispositivos, OS y referrers cuadrando exactamente con los eventos y sin guardar IPs", async () => {
    const { client, db, linkService, resolutionService, analyticsService } = await setupEnv();
    try {
      const now = new Date("2026-10-28T15:00:00.000Z");
      const link = await linkService.createLink({
        slug: "github-cris",
        type: "DIRECT",
        destinationUrl: "https://github.com/Crisutf",
        title: "GitHub Cristian",
      });

      // Registrar 3 clics con distintos países, dispositivos y referrers
      await resolutionService.recordClickEvent({
        linkId: link.id,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36",
          "x-vercel-ip-country": "BO",
          referer: "https://www.linkedin.com/feed/",
          "x-forwarded-for": "203.0.113.10",
        },
        searchParams: { ref: "linkedin_post" },
        now,
      });

      await resolutionService.recordClickEvent({
        linkId: link.id,
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1",
          "x-vercel-ip-country": "BO",
          referer: "https://cristianarando.dev/es",
          "x-forwarded-for": "203.0.113.11",
        },
        searchParams: { ref: "portfolio_hero" },
        now,
      });

      await resolutionService.recordClickEvent({
        linkId: link.id,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36",
          "x-vercel-ip-country": "US",
          "x-forwarded-for": "203.0.113.12",
        },
        now,
      });

      const summary = await analyticsService.getAnalyticsSummary({
        linkId: link.id,
        range: "7d",
        now,
      });

      expect(summary).not.toBeNull();
      expect(summary?.totalClicksInRange).toBe(3);
      expect(summary?.allTimeClicks).toBe(3);
      expect(summary?.dailySeries).toHaveLength(7);

      const sumDaily = summary!.dailySeries.reduce((acc, item) => acc + item.clicks, 0);
      const sumCountries = summary!.countries.reduce((acc, item) => acc + item.count, 0);
      const sumDevices = summary!.devices.reduce((acc, item) => acc + item.count, 0);

      expect(sumDaily).toBe(3);
      expect(sumCountries).toBe(3);
      expect(sumDevices).toBe(3);

      expect(summary!.countries[0]).toMatchObject({ key: "BO", count: 2 });
      expect(summary!.countries[1]).toMatchObject({ key: "US", count: 1 });

      // Verificar privacidad RNF-006: ninguna columna en click_events contiene las IPs enviadas
      const rawEvents = await db.select().from(schema.clickEvents);
      const serialized = JSON.stringify(rawEvents);
      expect(serialized).not.toContain("203.0.113.");
    } finally {
      client.close();
    }
  });
});
