import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { handleSlugGet } from "../../src/app/(public)/[slug]/route";
import { handleHubSubLinkClickPost } from "../../src/app/api/v1/slug/[slug]/hub-click/route";
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

describe("T-015: Modo Micro-Landing de Proyecto (type = 'HUB')", () => {
  it("renderiza título, descripción, tags y botones en GET /[slug] y registra sub_link_id al pulsar un botón", async () => {
    const { client, db, linkService, resolutionService } = await setupEnv();
    try {
      const hub = await linkService.createLink({
        slug: "proyecto-guia-turistica",
        type: "HUB",
        title: "Guía Turística Inteligente",
        description: "Plataforma full-stack con mapas interactivos.",
        tags: ["nextjs", "turso", "tailwind"],
        hubLinks: [
          {
            id: "btn-repo",
            label: "Repositorio en GitHub",
            url: "https://github.com/Crisutf/guia-turistica",
            icon: "github",
            variant: "primary",
          },
          {
            id: "btn-demo",
            label: "Demo en Vivo",
            url: "https://guia.cristianarando.dev",
            icon: "globe",
            variant: "secondary",
          },
        ],
      });

      const pageRes = await handleSlugGet(
        new Request("https://cristianarando.dev/proyecto-guia-turistica", {
          headers: { "user-agent": "Mozilla/5.0 Chrome/135.0" },
        }),
        "proyecto-guia-turistica",
        resolutionService
      );

      expect(pageRes.status).toBe(200);
      const html = await pageRes.text();
      expect(html).toContain("Guía Turística Inteligente");
      expect(html).toContain("Plataforma full-stack con mapas interactivos.");
      expect(html).toContain("#nextjs");
      expect(html).toContain("Repositorio en GitHub");
      expect(html).toContain("Demo en Vivo");

      // Simular clic en el botón "btn-demo"
      const clickRes = await handleHubSubLinkClickPost(
        new Request("https://cristianarando.dev/api/v1/slug/proyecto-guia-turistica/hub-click", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 Chrome/135.0",
          },
          body: JSON.stringify({ subLinkId: "btn-demo" }),
        }),
        "proyecto-guia-turistica",
        { db, resolution: resolutionService }
      );

      expect(clickRes.status).toBe(200);

      const events = await db
        .select()
        .from(schema.clickEvents)
        .where(eq(schema.clickEvents.linkId, hub.id));
      expect(events.some((e) => e.subLinkId === "btn-demo")).toBe(true);
    } finally {
      client.close();
    }
  });
});
