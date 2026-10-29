import { and, eq, sql } from "drizzle-orm";
import { monotonicFactory } from "ulidx";

import { clickEvents, links, type Link } from "../db/schema";
import { isPrefetchRequest, isSocialPreviewBot } from "@/lib/bot-detector";
import { isReservedSlug } from "@/lib/constants/reserved-slugs";
import { extractTrafficMetadata } from "@/lib/geo-headers";
import type { LinkDTO } from "@/lib/types/link-dto";
import { toLinkDTO, type AppDatabase } from "./link.service";

const nextEventId = monotonicFactory();

export type InactiveReason = "INACTIVE" | "EXPIRED" | "MAX_CLICKS_REACHED";

export type SlugResolutionResult =
  | {
      kind: "NOT_FOUND";
      status: 404;
      slug: string;
      shouldTrackClick: false;
    }
  | {
      kind: "INACTIVE_OR_EXPIRED";
      status: 410;
      reason: InactiveReason;
      slug: string;
      title: string;
      shouldTrackClick: false;
    }
  | {
      kind: "SOCIAL_BOT_OG";
      status: 200;
      link: LinkDTO;
      shouldTrackClick: false;
    }
  | {
      kind: "PIN_REQUIRED";
      status: 200;
      linkId: string;
      slug: string;
      title: string;
      description: string | null;
      icon: string;
      shouldTrackClick: false;
    }
  | {
      kind: "HUB_VIEW";
      status: 200;
      linkId: string;
      link: LinkDTO;
      shouldTrackClick: boolean;
    }
  | {
      kind: "REDIRECT";
      status: 301 | 302 | 307 | 308;
      linkId: string;
      location: string;
      shouldTrackClick: boolean;
    };

export interface ResolveSlugOptions {
  headers?: Headers | Record<string, string | string[] | undefined>;
  searchParams?: URLSearchParams | Record<string, string | undefined>;
  now?: Date;
}

export interface RecordClickInput {
  linkId: string;
  subLinkId?: string | null;
  headers?: Headers | Record<string, string | string[] | undefined>;
  searchParams?: URLSearchParams | Record<string, string | undefined>;
  now?: Date;
}

const SLUG_FAST_REGEX = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

function readHeader(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  name: string
): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const value = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toUrlSearchParams(
  input: URLSearchParams | Record<string, string | undefined> | undefined
): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(input)) {
    if (typeof val === "string") params.append(key, val);
  }
  return params;
}

/**
 * Fusiona los query params entrantes en la URL de destino sin permitir
 * alteración de protocolo/host/path ni sobrescribir parámetros ya definidos en el destino.
 */
export function buildDestinationUrl(
  baseDestination: string,
  incomingParams: URLSearchParams,
  forwardQueryParams: boolean
): string {
  const target = new URL(baseDestination);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Protocolo de destino no permitido");
  }

  if (forwardQueryParams) {
    incomingParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) {
        target.searchParams.set(key, value);
      }
    });
  }

  return target.toString();
}

function classifyInactiveReason(row: Link, nowMs: number): InactiveReason | null {
  if (!row.isActive) return "INACTIVE";
  if (row.expiresAt && row.expiresAt.getTime() <= nowMs) return "EXPIRED";
  if (row.maxClicks !== null && row.clicksCount >= row.maxClicks) return "MAX_CLICKS_REACHED";
  return null;
}

export function createResolutionService(db: AppDatabase) {
  async function resolveSlugRequest(
    rawSlug: string,
    options: ResolveSlugOptions = {}
  ): Promise<SlugResolutionResult> {
    const normalized = rawSlug.trim().toLowerCase();

    // Filtro rápido en memoria: evita tocar Turso para archivos estáticos, rutas reservadas o slugs inválidos.
    if (
      normalized.length < 3 ||
      normalized.length > 100 ||
      normalized.includes(".") ||
      !SLUG_FAST_REGEX.test(normalized) ||
      isReservedSlug(normalized)
    ) {
      return { kind: "NOT_FOUND", status: 404, slug: normalized, shouldTrackClick: false };
    }

    const rows = await db.select().from(links).where(eq(links.slug, normalized)).limit(1);
    const row = rows[0];
    if (!row) {
      return { kind: "NOT_FOUND", status: 404, slug: normalized, shouldTrackClick: false };
    }

    const now = options.now ?? new Date();
    const inactiveReason = classifyInactiveReason(row, now.getTime());
    if (inactiveReason) {
      return {
        kind: "INACTIVE_OR_EXPIRED",
        status: 410,
        reason: inactiveReason,
        slug: row.slug,
        title: row.title,
        shouldTrackClick: false,
      };
    }

    const userAgent = readHeader(options.headers, "user-agent");
    if (isSocialPreviewBot(userAgent)) {
      return {
        kind: "SOCIAL_BOT_OG",
        status: 200,
        link: toLinkDTO(row, now),
        shouldTrackClick: false,
      };
    }

    if (row.passwordHash !== null) {
      return {
        kind: "PIN_REQUIRED",
        status: 200,
        linkId: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        icon: row.icon,
        shouldTrackClick: false,
      };
    }

    const isPrefetch = options.headers ? isPrefetchRequest(options.headers) : false;

    if (row.type === "HUB") {
      return {
        kind: "HUB_VIEW",
        status: 200,
        linkId: row.id,
        link: toLinkDTO(row, now),
        shouldTrackClick: !isPrefetch,
      };
    }

    if (!row.destinationUrl) {
      return { kind: "NOT_FOUND", status: 404, slug: normalized, shouldTrackClick: false };
    }

    let location: string;
    try {
      location = buildDestinationUrl(
        row.destinationUrl,
        toUrlSearchParams(options.searchParams),
        row.forwardQueryParams
      );
    } catch {
      return { kind: "NOT_FOUND", status: 404, slug: normalized, shouldTrackClick: false };
    }

    const status = (
      row.redirectStatus === 301 ||
      row.redirectStatus === 302 ||
      row.redirectStatus === 307 ||
      row.redirectStatus === 308
        ? row.redirectStatus
        : 307
    ) as 301 | 302 | 307 | 308;

    return {
      kind: "REDIRECT",
      status,
      linkId: row.id,
      location,
      shouldTrackClick: !isPrefetch,
    };
  }

  /**
   * Incrementa atómicamente `clicks_count` y registra una fila en `click_events`.
   * Respeta el límite `max_clicks` y `expires_at` en la propia sentencia UPDATE.
   * Nunca lanza errores hacia el caller para no afectar el flujo de redirección.
   */
  async function recordClickEvent(input: RecordClickInput): Promise<boolean> {
    try {
      const userAgent = readHeader(input.headers, "user-agent");
      if (isSocialPreviewBot(userAgent)) return false;
      if (input.headers && isPrefetchRequest(input.headers)) return false;

      const now = input.now ?? new Date();
      const nowMs = now.getTime();

      const updateResult = await db
        .update(links)
        .set({
          clicksCount: sql`${links.clicksCount} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(links.id, input.linkId),
            eq(links.isActive, true),
            sql`(${links.expiresAt} IS NULL OR ${links.expiresAt} > ${nowMs})`,
            sql`(${links.maxClicks} IS NULL OR ${links.clicksCount} < ${links.maxClicks})`
          )
        );

      if (updateResult.rowsAffected === 0) {
        return false;
      }

      const meta = extractTrafficMetadata(input.headers ?? {}, input.searchParams);
      await db.insert(clickEvents).values({
        id: nextEventId(),
        linkId: input.linkId,
        subLinkId: input.subLinkId ?? null,
        country: meta.country,
        city: meta.city,
        device: meta.device,
        os: meta.os,
        browser: meta.browser,
        referrer: meta.referrer,
        queryParamRef: meta.queryParamRef,
        clickedAt: now,
      });

      return true;
    } catch {
      return false;
    }
  }

  return {
    resolveSlugRequest,
    recordClickEvent,
  };
}

export type ResolutionService = ReturnType<typeof createResolutionService>;
