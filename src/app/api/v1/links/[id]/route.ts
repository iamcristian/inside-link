import type { NextRequest } from "next/server";
import { assertAdminApiSession } from "@/server/auth/session";
import { linkService } from "@/server/services";
import { handleLinkError, type AdminApiDeps } from "../route";

export async function handleUpdateLinkPatch(
  request: NextRequest | Request,
  id: string,
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
    const updated = await service.updateLink(id, body);
    return Response.json(updated, { status: 200 });
  } catch (err) {
    return handleLinkError(err);
  }
}

export async function handleDeleteLinkDelete(
  request: NextRequest | Request,
  id: string,
  deps: AdminApiDeps = {}
): Promise<Response> {
  const checkAuth = deps.checkAuth ?? assertAdminApiSession;
  const authResult = await checkAuth(request.headers);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const service = deps.service ?? linkService;

  try {
    await service.deleteLink(id);
    return Response.json({ deleted: true, id }, { status: 200 });
  } catch (err) {
    return handleLinkError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return handleUpdateLinkPatch(request, id);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return handleDeleteLinkDelete(request, id);
}
