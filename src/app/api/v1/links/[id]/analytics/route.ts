import { NextResponse } from "next/server";
import { assertAdminApiSession } from "@/server/auth/session";
import {
  analyticsService,
  type AnalyticsRange,
  type AnalyticsService,
} from "@/server/services";

function parseRange(raw: string | null): AnalyticsRange {
  if (raw === "7d" || raw === "30d" || raw === "90d") return raw;
  return "30d";
}

export async function handleGetLinkAnalytics(
  request: Request,
  id: string,
  service: AnalyticsService = analyticsService
): Promise<NextResponse> {
  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range"));

  const summary = await service.getAnalyticsSummary({
    linkId: id,
    range,
  });

  if (!summary) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Enlace no encontrado" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: summary });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const guard = await assertAdminApiSession(request.headers);
  if (!guard.authorized) return guard.response;
  const { id } = await context.params;
  return handleGetLinkAnalytics(request, id);
}
