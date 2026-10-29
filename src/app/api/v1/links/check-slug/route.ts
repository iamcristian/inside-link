import type { NextRequest } from "next/server";
import { assertAdminApiSession } from "@/server/auth/session";
import { linkService } from "@/server/services";
import { handleLinkError, type AdminApiDeps } from "../route";

export async function handleCheckSlugGet(
  request: NextRequest | Request,
  deps: AdminApiDeps = {}
): Promise<Response> {
  const checkAuth = deps.checkAuth ?? assertAdminApiSession;
  const authResult = await checkAuth(request.headers);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const service = deps.service ?? linkService;
  const url = new URL(request.url);

  try {
    if (url.searchParams.get("action") === "generate") {
      const slug = await service.generateUniqueRandomSlug(6);
      return Response.json(
        { available: true, normalizedSlug: slug },
        { status: 200 }
      );
    }

    const rawSlug = url.searchParams.get("slug") ?? "";
    const excludeId = url.searchParams.get("excludeId") || undefined;

    if (!rawSlug.trim()) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "El parámetro 'slug' es obligatorio.",
          },
        },
        { status: 400 }
      );
    }

    const result = await service.checkSlugAvailability(rawSlug, excludeId);
    return Response.json(result, { status: 200 });
  } catch (err) {
    return handleLinkError(err);
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleCheckSlugGet(request);
}
