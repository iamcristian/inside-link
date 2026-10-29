import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { links } from "@/server/db/schema";
import { resolutionService, type AppDatabase } from "@/server/services";
import type { ResolutionService } from "@/server/services/resolution.service";

const HubClickBodySchema = z.object({
  subLinkId: z.string().trim().min(1).max(64),
});

export async function handleHubSubLinkClickPost(
  request: Request,
  slug: string,
  deps: { db: AppDatabase; resolution: ResolutionService } = {
    db,
    resolution: resolutionService,
  }
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Cuerpo JSON inválido" } },
      { status: 400 }
    );
  }

  const parsed = HubClickBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "subLinkId es obligatorio" } },
      { status: 400 }
    );
  }

  const normalizedSlug = slug.trim().toLowerCase();
  const rows = await deps.db
    .select()
    .from(links)
    .where(eq(links.slug, normalizedSlug))
    .limit(1);
  const row = rows[0];

  if (!row || row.type !== "HUB" || !row.isActive) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Micro-landing no encontrada o inactiva" } },
      { status: 404 }
    );
  }

  const recorded = await deps.resolution.recordClickEvent({
    linkId: row.id,
    subLinkId: parsed.data.subLinkId,
    headers: request.headers,
  });

  return NextResponse.json({ data: { recorded, subLinkId: parsed.data.subLinkId } });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await context.params;
  return handleHubSubLinkClickPost(request, slug);
}
