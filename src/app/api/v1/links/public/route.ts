import { NextResponse } from "next/server";
import {
  httpStatusForLinkError,
  linkService,
  LinkServiceError,
  type LinkService,
} from "@/server/services";

export async function handleListPublicLinksGet(
  request: Request,
  service: LinkService = linkService
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const page = await service.listPublicLinks({
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
      q: url.searchParams.get("q"),
      category: url.searchParams.get("category"),
    });
    return NextResponse.json(page, {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    if (err instanceof LinkServiceError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        { status: httpStatusForLinkError(err.code) }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } },
      { status: 500 }
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return handleListPublicLinksGet(request);
}
