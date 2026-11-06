import type { LinkService } from "@/server/services/link.service";
import { renderOgImage } from "./card";
import {
  buildOgPresentation,
  ogRevision,
  type OgPresentation,
} from "./presentation";

const noStore = {
  "Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
};

export async function respondWithOg(
  card: OgPresentation,
  headers: HeadersInit = noStore,
) {
  try {
    const png = await renderOgImage(card, headers).arrayBuffer();
    return new Response(png, {
      headers: {
        ...headers,
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("InsideLink OG rendering failed");
    return new Response(null, { status: 503, headers: noStore });
  }
}

export async function handleOgGet(
  request: Request,
  id: string,
  revision: string,
  service: Pick<LinkService, "getLinkById">,
): Promise<Response> {
  const notFound = () => new Response(null, { status: 404, headers: noStore });
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(id) || !/^[a-f0-9]{32}$/.test(revision))
    return notFound();

  try {
    const link = await service.getLinkById(id);
    if (
      !link?.isActive ||
      link.isExpired ||
      link.hasPin ||
      link.ogMode === "minimal"
    )
      return notFound();
    const card = buildOgPresentation(link);
    if (ogRevision(card) !== revision) return notFound();
    const etag = `W/"${revision}"`;
    const headers = {
      ...noStore,
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: etag,
    };
    const validators = request.headers
      .get("if-none-match")
      ?.split(",")
      .map((value) => value.trim().replace(/^W\//, ""));
    if (validators?.includes(etag.slice(2)) || validators?.includes("*")) {
      return new Response(null, { status: 304, headers });
    }
    const response = await respondWithOg(card, headers);
    if (response.ok) return response;
  } catch {
    console.error("InsideLink OG lookup failed");
  }
  return respondWithOg(buildOgPresentation());
}
