import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyPin } from "@/server/crypto/pin";
import {
  checkPinRateLimit,
  extractClientIdentifier,
  recordFailedPinAttempt,
  resetPinAttempts,
} from "@/server/crypto/rate-limit";
import { db } from "@/server/db";
import { links } from "@/server/db/schema";
import { resolutionService, toLinkDTO, type AppDatabase } from "@/server/services";
import type { ResolutionService } from "@/server/services/resolution.service";

const UnlockBodySchema = z.object({
  pin: z.string().trim().min(1, "El PIN es obligatorio").max(64),
});

export async function handlePinUnlockPost(
  request: Request,
  slug: string,
  deps: {
    db: AppDatabase;
    resolution: ResolutionService;
    now?: Date;
  } = {
    db,
    resolution: resolutionService,
  }
): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Cuerpo JSON inválido" } },
      { status: 400 }
    );
  }

  const parsed = UnlockBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Formato de PIN inválido" } },
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

  if (!row) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Enlace no encontrado" } },
      { status: 404 }
    );
  }

  const now = deps.now ?? new Date();
  if (
    !row.isActive ||
    (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) ||
    (row.maxClicks !== null && row.clicksCount >= row.maxClicks)
  ) {
    return NextResponse.json(
      { error: { code: "LINK_INACTIVE_OR_EXPIRED", message: "Este enlace ya no está activo" } },
      { status: 410 }
    );
  }

  if (!row.passwordHash) {
    return NextResponse.json(
      { error: { code: "PIN_NOT_CONFIGURED", message: "Este enlace no requiere PIN" } },
      { status: 400 }
    );
  }

  const clientIp = extractClientIdentifier(request.headers);
  const rateLimit = await checkPinRateLimit(deps.db, row.id, clientIp, now);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Demasiados intentos fallidos. Intenta de nuevo en ${rateLimit.retryAfterSeconds}s.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "Cache-Control": "private, no-store",
        },
      }
    );
  }

  const isPinValid = verifyPin(parsed.data.pin, row.passwordHash);
  if (!isPinValid) {
    const failed = await recordFailedPinAttempt(deps.db, row.id, clientIp, now);
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PIN",
          message: "PIN incorrecto",
          remainingAttempts: failed.remainingAttempts,
        },
      },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }

  // PIN válido: limpiamos contadores de intentos fallidos y registramos el clic válido
  await resetPinAttempts(deps.db, row.id, clientIp);
  await deps.resolution.recordClickEvent({
    linkId: row.id,
    headers: request.headers,
    now,
  });

  const dto = toLinkDTO(row, now);
  return NextResponse.json(
    {
      data: {
        slug: dto.slug,
        type: dto.type,
        destinationUrl: dto.type === "DIRECT" ? dto.destinationUrl : null,
        hubLinks: dto.type === "HUB" ? dto.hubLinks : null,
      },
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await context.params;
  return handlePinUnlockPost(request, slug);
}
