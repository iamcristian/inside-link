import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { buildOgPresentation, ogRevision } from "@/server/og/presentation";
import { handleOgGet } from "@/server/og/response";
import { createLinkService } from "@/server/services/link.service";
import { renderOpenGraphHtml } from "@/server/services/og-render.service";
import { createResolutionService } from "@/server/services/resolution.service";

it("generates a PNG without tracking and stops serving it when the link gains a PIN", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "src/server/db/migrations" });
    const service = createLinkService(db);
    const link = await service.createLink({
      slug: "og-card-test",
      title: "Private draft <&>",
      description: "A custom link card",
      destinationUrl: "https://example.com/destination",
    });

    const revision = ogRevision(buildOgPresentation(link));
    expect(renderOpenGraphHtml(link)).toContain(
      `/api/v1/og/${link.id}/${revision}/image.png`,
    );
    const request = new Request("https://example.com");
    const response = await handleOgGet(request, link.id, revision, service);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect((await service.getLinkById(link.id))?.clicksCount).toBe(0);

    await createResolutionService(db).recordClickEvent({ linkId: link.id });
    const conditional = new Request(request, {
      headers: { "If-None-Match": response.headers.get("etag")! },
    });
    expect(
      (await handleOgGet(conditional, link.id, revision, service)).status,
    ).toBe(304);

    const protectedLink = await service.updateLink(link.id, {
      pin: "1234",
      ogImageUrl: "https://example.com/private.png",
    });
    const html = renderOpenGraphHtml(protectedLink);
    expect(html).toContain("/api/v1/og/protected/image.png");
    expect(html).not.toMatch(
      /Private draft|private\.png|example\.com\/destination/,
    );
    expect(
      (await handleOgGet(conditional, link.id, revision, service)).status,
    ).toBe(404);
  } finally {
    client.close();
  }
});
