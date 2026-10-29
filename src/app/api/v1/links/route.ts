import type { NextRequest } from "next/server";
import { assertAdminApiSession } from "@/server/auth/session";
import { linkService } from "@/server/services";
import {
  httpStatusForLinkError,
  LinkServiceError,
  type LinkService,
} from "@/server/services/link.service";

export interface AdminApiDeps {
  service?: LinkService;
  checkAuth?: typeof assertAdminApiSession;
}

export function handleLinkError(err: unknown): Response {
  if (err instanceof LinkServiceError) {
    return Response.json(
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

  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor al procesar el enlace.",
      },
    },
    { status: 500 }
  );
}

export async function handleListLinksGet(
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
    const page = await service.listLinksPaginated({
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
      q: url.searchParams.get("q"),
      category: url.searchParams.get("category"),
      status: url.searchParams.get("status"),
    });
    return Response.json(page, { status: 200 });
  } catch (err) {
    return handleLinkError(err);
  }
}

export async function handleCreateLinkPost(
  request: NextRequest | Request,
  deps: AdminApiDeps = {}
): Promise<Response> {
  const checkAuth = deps.checkAuth ?? assertAdminApiSession;
  const authResult = await checkAuth(request.headers);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const service = deps.service ?? linkService;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "El cuerpo de la petición no es un JSON válido.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const created = await service.createLink(body);
    return Response.json(created, { status: 201 });
  } catch (err) {
    return handleLinkError(err);
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleListLinksGet(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleCreateLinkPost(request);
}
