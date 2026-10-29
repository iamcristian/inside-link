import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { pinAttempts } from "@/server/db/schema";
import type { AppDatabase } from "@/server/services/link.service";

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_WINDOW_MS = 60_000;

export function extractClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  return "anonymous-local";
}

/**
 * Calcula una clave irreversible SHA-256 combinando linkId + IP efímera + secreto del servidor,
 * cumpliendo RNF-006 (jamás persistir direcciones IP en texto plano en SQLite).
 */
export function computePinAttemptKey(linkId: string, clientIp: string): string {
  const salt = process.env.BETTER_AUTH_SECRET || "insidelink-pin-rate-limit-salt";
  return createHash("sha256")
    .update(`${salt}:${linkId}:${clientIp}`)
    .digest("hex");
}

export interface PinRateLimitStatus {
  allowed: boolean;
  attemptsCount: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

export async function checkPinRateLimit(
  db: AppDatabase,
  linkId: string,
  clientIp: string,
  now: Date = new Date()
): Promise<PinRateLimitStatus> {
  const key = computePinAttemptKey(linkId, clientIp);
  const rows = await db
    .select()
    .from(pinAttempts)
    .where(eq(pinAttempts.key, key))
    .limit(1);
  const existing = rows[0];

  if (!existing || existing.windowExpiresAt.getTime() <= now.getTime()) {
    return {
      allowed: true,
      attemptsCount: 0,
      remainingAttempts: PIN_MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (existing.attemptsCount >= PIN_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.windowExpiresAt.getTime() - now.getTime()) / 1000)
    );
    return {
      allowed: false,
      attemptsCount: existing.attemptsCount,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    attemptsCount: existing.attemptsCount,
    remainingAttempts: Math.max(0, PIN_MAX_ATTEMPTS - existing.attemptsCount),
    retryAfterSeconds: 0,
  };
}

export async function recordFailedPinAttempt(
  db: AppDatabase,
  linkId: string,
  clientIp: string,
  now: Date = new Date()
): Promise<{ attemptsCount: number; remainingAttempts: number }> {
  const key = computePinAttemptKey(linkId, clientIp);
  const rows = await db
    .select()
    .from(pinAttempts)
    .where(eq(pinAttempts.key, key))
    .limit(1);
  const existing = rows[0];
  const windowExpiresAt = new Date(now.getTime() + PIN_WINDOW_MS);

  if (!existing || existing.windowExpiresAt.getTime() <= now.getTime()) {
    if (existing) {
      await db
        .update(pinAttempts)
        .set({ attemptsCount: 1, windowExpiresAt })
        .where(eq(pinAttempts.key, key));
    } else {
      await db.insert(pinAttempts).values({
        key,
        linkId,
        attemptsCount: 1,
        windowExpiresAt,
      });
    }
    return { attemptsCount: 1, remainingAttempts: PIN_MAX_ATTEMPTS - 1 };
  }

  const nextCount = existing.attemptsCount + 1;
  await db
    .update(pinAttempts)
    .set({ attemptsCount: nextCount })
    .where(eq(pinAttempts.key, key));

  return {
    attemptsCount: nextCount,
    remainingAttempts: Math.max(0, PIN_MAX_ATTEMPTS - nextCount),
  };
}

export async function resetPinAttempts(
  db: AppDatabase,
  linkId: string,
  clientIp: string
): Promise<void> {
  const key = computePinAttemptKey(linkId, clientIp);
  await db.delete(pinAttempts).where(eq(pinAttempts.key, key));
}
