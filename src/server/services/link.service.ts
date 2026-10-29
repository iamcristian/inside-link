import { randomInt } from "node:crypto";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { monotonicFactory } from "ulidx";
import { z } from "zod";

import * as schema from "../db/schema";
import { links, type Link, type NewLink } from "../db/schema";
import { hashPin } from "../crypto/pin";
import { decodeLinkCursor, encodeLinkCursor } from "@/lib/cursor";
import { classifySlug } from "@/lib/validations/slug.schema";
import {
  BaseLinkSchema,
  CreateLinkSchema,
  HubLinkItemSchema,
  LinkCategorySchema,
  type HubLinkItem,
} from "@/lib/validations/link.schema";
import type {
  LinkCategory,
  LinkDTO,
  LinkStatusFilter,
  PaginatedResult,
  PublicLinkDTO,
  SlugAvailability,
} from "@/lib/types/link-dto";

export type AppDatabase = LibSQLDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Errores de dominio
// ---------------------------------------------------------------------------

export type LinkServiceErrorCode =
  | "NOT_FOUND"
  | "SLUG_RESERVED"
  | "SLUG_ALREADY_EXISTS"
  | "VALIDATION_ERROR"
  | "SLUG_GENERATION_FAILED";

export class LinkServiceError extends Error {
  readonly code: LinkServiceErrorCode;
  readonly details?: Record<string, string[]>;

  constructor(code: LinkServiceErrorCode, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "LinkServiceError";
    this.code = code;
    this.details = details;
  }
}

/** Mapeo canónico de errores de dominio a códigos HTTP (usado por los Route Handlers en T-009). */
export function httpStatusForLinkError(code: LinkServiceErrorCode): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "SLUG_RESERVED":
      return 422;
    case "SLUG_ALREADY_EXISTS":
      return 409;
    case "VALIDATION_ERROR":
      return 400;
    case "SLUG_GENERATION_FAILED":
      return 500;
  }
}

// ---------------------------------------------------------------------------
// Constantes y utilidades internas
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
const RANDOM_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_SLUG_MAX_ATTEMPTS = 10;

const LinkStatusFilterSchema = z.enum(["all", "active", "inactive", "expired", "pinned"]);
const TagsSchema = z.array(z.string());
const HubLinksSchema = z.array(HubLinkItemSchema);

/** IDs ULID monótonos: garantizan orden estricto incluso si se crean varios en el mismo ms. */
const nextId = monotonicFactory();

function canonicalBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CANONICAL_URL || "https://cristianarando.dev").replace(/\/+$/, "");
}

function zodDetails(error: z.ZodError): Record<string, string[]> {
  const flat = error.flatten();
  const details: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) details[key] = messages;
  }
  if (flat.formErrors.length > 0) details["_form"] = flat.formErrors;
  return details;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new LinkServiceError("VALIDATION_ERROR", "El cuerpo de la petición debe ser un objeto JSON");
  }
  return input as Record<string, unknown>;
}

function safeJsonArray<T>(raw: string | null, parser: z.ZodType<T[], z.ZodTypeDef, unknown>): T[] | null {
  if (!raw) return null;
  try {
    const result = parser.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function toCategory(value: string): LinkCategory {
  const parsed = LinkCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : "project";
}

function isUniqueSlugViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof Error && /UNIQUE constraint failed: links\.slug/i.test(current.message)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function isLinkExpired(row: Pick<Link, "expiresAt" | "maxClicks" | "clicksCount">, now: Date = new Date()): boolean {
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return true;
  if (row.maxClicks !== null && row.clicksCount >= row.maxClicks) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Mapeadores fila -> DTO (nunca exponen password_hash)
// ---------------------------------------------------------------------------

export function toLinkDTO(row: Link, now: Date = new Date()): LinkDTO {
  return {
    id: row.id,
    slug: row.slug,
    shortUrl: `${canonicalBaseUrl()}/${row.slug}`,
    type: row.type,
    destinationUrl: row.destinationUrl,
    redirectStatus: row.redirectStatus,
    forwardQueryParams: row.forwardQueryParams,
    hubLinks: safeJsonArray<HubLinkItem>(row.hubLinksJson, HubLinksSchema),
    title: row.title,
    description: row.description,
    ogImageUrl: row.ogImageUrl,
    category: toCategory(row.category),
    tags: safeJsonArray<string>(row.tagsJson, TagsSchema) ?? [],
    icon: row.icon,
    isActive: row.isActive,
    isPublic: row.isPublic,
    isPinned: row.isPinned,
    hasPin: row.passwordHash !== null,
    isExpired: isLinkExpired(row, now),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    maxClicks: row.maxClicks,
    clicksCount: row.clicksCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicLinkDTO(row: Link): PublicLinkDTO {
  return {
    id: row.id,
    slug: row.slug,
    shortUrl: `${canonicalBaseUrl()}/${row.slug}`,
    type: row.type,
    title: row.title,
    description: row.description,
    category: toCategory(row.category),
    tags: safeJsonArray<string>(row.tagsJson, TagsSchema) ?? [],
    icon: row.icon,
    isPinned: row.isPinned,
    hasPin: row.passwordHash !== null,
  };
}

// ---------------------------------------------------------------------------
// Fragmentos SQL reutilizables
// ---------------------------------------------------------------------------

function notExpiredSql(nowMs: number): SQL {
  return sql`((${links.expiresAt} IS NULL OR ${links.expiresAt} > ${nowMs}) AND (${links.maxClicks} IS NULL OR ${links.clicksCount} < ${links.maxClicks}))`;
}

function expiredSql(nowMs: number): SQL {
  return sql`((${links.expiresAt} IS NOT NULL AND ${links.expiresAt} <= ${nowMs}) OR (${links.maxClicks} IS NOT NULL AND ${links.clicksCount} >= ${links.maxClicks}))`;
}

function searchSql(term: string): SQL {
  // Escapar comodines de LIKE para que la búsqueda sea literal.
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const pattern = `%${escaped}%`;
  return sql`(${links.slug} LIKE ${pattern} ESCAPE '\\' OR ${links.title} LIKE ${pattern} ESCAPE '\\' OR ${links.description} LIKE ${pattern} ESCAPE '\\' OR ${links.destinationUrl} LIKE ${pattern} ESCAPE '\\')`;
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

export interface ListLinksParams {
  cursor?: string | null;
  limit?: number | string | null;
  q?: string | null;
  category?: string | null;
  status?: string | null;
  now?: Date;
}

export interface LinkFlagsPatch {
  isActive?: boolean;
  isPinned?: boolean;
  isPublic?: boolean;
}

export function createLinkService(db: AppDatabase) {
  async function findRowById(id: string): Promise<Link | null> {
    const rows = await db.select().from(links).where(eq(links.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async function findRowBySlug(slug: string): Promise<Link | null> {
    const rows = await db.select().from(links).where(eq(links.slug, slug)).limit(1);
    return rows[0] ?? null;
  }

  /** Valida un slug crudo y devuelve su forma normalizada, o lanza un error de dominio. */
  function assertValidSlug(raw: string): string {
    const result = classifySlug(raw);
    if (!result.ok) {
      throw new LinkServiceError(
        result.reason === "RESERVED" ? "SLUG_RESERVED" : "VALIDATION_ERROR",
        result.message,
        { slug: [result.message] }
      );
    }
    return result.normalized;
  }

  async function assertSlugFree(slug: string, excludeId?: string): Promise<void> {
    const existing = await findRowBySlug(slug);
    if (existing && existing.id !== excludeId) {
      throw new LinkServiceError("SLUG_ALREADY_EXISTS", `El slug "${slug}" ya está en uso`, {
        slug: [`El slug "${slug}" ya está en uso`],
      });
    }
  }

  async function checkSlugAvailability(rawSlug: string, excludeId?: string): Promise<SlugAvailability> {
    const result = classifySlug(rawSlug);
    if (!result.ok) {
      return {
        available: false,
        normalizedSlug: result.normalized,
        reason: result.reason,
        message: result.message,
      };
    }

    const existing = await findRowBySlug(result.normalized);
    if (existing && existing.id !== excludeId) {
      return {
        available: false,
        normalizedSlug: result.normalized,
        reason: "TAKEN",
        message: `El slug "${result.normalized}" ya está en uso`,
      };
    }

    return { available: true, normalizedSlug: result.normalized };
  }

  async function generateUniqueRandomSlug(length = 6): Promise<string> {
    const size = Math.min(Math.max(Math.trunc(length), 4), 32);
    for (let attempt = 0; attempt < RANDOM_SLUG_MAX_ATTEMPTS; attempt++) {
      let candidate = "";
      for (let i = 0; i < size; i++) {
        candidate += RANDOM_SLUG_ALPHABET.charAt(randomInt(RANDOM_SLUG_ALPHABET.length));
      }
      if (!classifySlug(candidate).ok) continue;
      if (!(await findRowBySlug(candidate))) return candidate;
    }
    throw new LinkServiceError(
      "SLUG_GENERATION_FAILED",
      "No se pudo generar un slug aleatorio único tras varios intentos"
    );
  }

  async function getLinkById(id: string): Promise<LinkDTO | null> {
    const row = await findRowById(id);
    return row ? toLinkDTO(row) : null;
  }

  async function createLink(rawInput: unknown): Promise<LinkDTO> {
    const input = asRecord(rawInput);
    const rawSlug = typeof input.slug === "string" ? input.slug.trim() : "";

    let slug: string | null = null;
    if (rawSlug.length > 0) {
      slug = assertValidSlug(rawSlug);
      await assertSlugFree(slug);
    }

    const parsed = CreateLinkSchema.safeParse({
      ...input,
      slug: slug ?? (input.slug == null || input.slug === "" ? undefined : input.slug),
    });
    if (!parsed.success) {
      throw new LinkServiceError("VALIDATION_ERROR", "Datos de enlace inválidos", zodDetails(parsed.error));
    }
    const data = parsed.data;
    const finalSlug = slug ?? (await generateUniqueRandomSlug());
    const now = new Date();
    const id = nextId();

    const values: NewLink = {
      id,
      slug: finalSlug,
      type: data.type,
      destinationUrl: data.type === "DIRECT" ? (data.destinationUrl ?? null) : null,
      redirectStatus: data.redirectStatus,
      forwardQueryParams: data.forwardQueryParams,
      hubLinksJson: data.type === "HUB" && data.hubLinks ? JSON.stringify(data.hubLinks) : null,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      ogImageUrl: data.ogImageUrl ?? null,
      category: data.category,
      tagsJson: JSON.stringify(Array.from(new Set(data.tags))),
      icon: data.icon,
      isActive: data.isActive,
      isPublic: data.isPublic,
      isPinned: data.isPinned,
      passwordHash: data.pin ? hashPin(data.pin) : null,
      expiresAt: data.expiresAt ?? null,
      maxClicks: data.maxClicks ?? null,
      clicksCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(links).values(values);
    } catch (err) {
      // Carrera entre la verificación y el INSERT: el índice UNIQUE es la barrera final.
      if (isUniqueSlugViolation(err)) {
        throw new LinkServiceError("SLUG_ALREADY_EXISTS", `El slug "${finalSlug}" ya está en uso`, {
          slug: [`El slug "${finalSlug}" ya está en uso`],
        });
      }
      throw err;
    }

    const created = await findRowById(id);
    if (!created) throw new Error("Invariante violada: el enlace recién creado no existe");
    return toLinkDTO(created);
  }

  async function updateLink(id: string, rawPatch: unknown): Promise<LinkDTO> {
    const existing = await findRowById(id);
    if (!existing) throw new LinkServiceError("NOT_FOUND", "Enlace no encontrado");

    const patch = asRecord(rawPatch);

    let newSlug: string | undefined;
    if (patch.slug !== undefined) {
      if (typeof patch.slug !== "string" || patch.slug.trim().length === 0) {
        throw new LinkServiceError("VALIDATION_ERROR", "El slug no puede quedar vacío", {
          slug: ["El slug no puede quedar vacío"],
        });
      }
      newSlug = assertValidSlug(patch.slug);
      if (newSlug !== existing.slug) await assertSlugFree(newSlug, id);
    }

    // El slug ya fue validado arriba; el resto se valida como parche parcial.
    const parsed = BaseLinkSchema.partial().safeParse({ ...patch, slug: undefined });
    if (!parsed.success) {
      throw new LinkServiceError("VALIDATION_ERROR", "Datos de enlace inválidos", zodDetails(parsed.error));
    }
    const data = parsed.data;

    // Invariante polimórfica evaluada sobre el estado FINAL (existente + parche).
    const finalType = data.type ?? existing.type;
    const finalDestination =
      data.destinationUrl !== undefined ? data.destinationUrl : existing.destinationUrl;
    const finalHubLinks =
      data.hubLinks !== undefined ? data.hubLinks : safeJsonArray(existing.hubLinksJson, HubLinksSchema);

    if (finalType === "DIRECT" && !finalDestination) {
      throw new LinkServiceError("VALIDATION_ERROR", "La URL de destino es obligatoria para enlaces DIRECT", {
        destinationUrl: ["La URL de destino es obligatoria para enlaces de tipo DIRECT"],
      });
    }
    if (finalType === "HUB" && (!finalHubLinks || finalHubLinks.length === 0)) {
      throw new LinkServiceError("VALIDATION_ERROR", "El modo HUB requiere al menos un sub-enlace", {
        hubLinks: ["Debe incluir al menos un sub-enlace para el modo HUB"],
      });
    }

    const updates: Partial<NewLink> = { updatedAt: new Date() };
    if (newSlug !== undefined) updates.slug = newSlug;
    if (data.type !== undefined) updates.type = data.type;
    if (data.redirectStatus !== undefined) updates.redirectStatus = data.redirectStatus;
    if (data.forwardQueryParams !== undefined) updates.forwardQueryParams = data.forwardQueryParams;
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.description !== undefined) updates.description = data.description?.trim() || null;
    if (data.ogImageUrl !== undefined) updates.ogImageUrl = data.ogImageUrl;
    if (data.category !== undefined) updates.category = data.category;
    if (data.tags !== undefined) updates.tagsJson = JSON.stringify(Array.from(new Set(data.tags)));
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.isPublic !== undefined) updates.isPublic = data.isPublic;
    if (data.isPinned !== undefined) updates.isPinned = data.isPinned;
    if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt;
    if (data.maxClicks !== undefined) updates.maxClicks = data.maxClicks;
    // pin: string => establecer/rotar; null => eliminar protección; undefined => sin cambios.
    if (data.pin !== undefined) updates.passwordHash = data.pin ? hashPin(data.pin) : null;

    // Mantener la fila coherente con su tipo final.
    if (finalType === "DIRECT") {
      updates.destinationUrl = finalDestination ?? null;
      updates.hubLinksJson = null;
    } else {
      updates.destinationUrl = null;
      updates.hubLinksJson = JSON.stringify(finalHubLinks);
    }

    try {
      await db.update(links).set(updates).where(eq(links.id, id));
    } catch (err) {
      if (isUniqueSlugViolation(err)) {
        throw new LinkServiceError("SLUG_ALREADY_EXISTS", `El slug "${newSlug}" ya está en uso`, {
          slug: [`El slug "${newSlug}" ya está en uso`],
        });
      }
      throw err;
    }

    const updated = await findRowById(id);
    if (!updated) throw new LinkServiceError("NOT_FOUND", "Enlace no encontrado");
    return toLinkDTO(updated);
  }

  async function toggleLinkFlags(id: string, flags: LinkFlagsPatch): Promise<LinkDTO> {
    const patch: LinkFlagsPatch = {};
    if (typeof flags.isActive === "boolean") patch.isActive = flags.isActive;
    if (typeof flags.isPinned === "boolean") patch.isPinned = flags.isPinned;
    if (typeof flags.isPublic === "boolean") patch.isPublic = flags.isPublic;
    return updateLink(id, patch);
  }

  async function deleteLink(id: string): Promise<void> {
    const result = await db.delete(links).where(eq(links.id, id));
    if (result.rowsAffected === 0) throw new LinkServiceError("NOT_FOUND", "Enlace no encontrado");
  }

  /** Consulta keyset sobre (is_pinned DESC, id DESC) compartida por /admin y /links. */
  async function queryPage(params: ListLinksParams, scope: "admin" | "public") {
    const now = params.now ?? new Date();
    const nowMs = now.getTime();

    let limit = DEFAULT_PAGE_SIZE;
    if (params.limit !== undefined && params.limit !== null && params.limit !== "") {
      const parsedLimit = Number(params.limit);
      if (!Number.isFinite(parsedLimit)) {
        throw new LinkServiceError("VALIDATION_ERROR", "El parámetro limit debe ser numérico", {
          limit: ["Debe ser un número entre 1 y 50"],
        });
      }
      limit = Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_PAGE_SIZE);
    }

    const conditions: SQL[] = [];

    if (params.cursor) {
      const cursor = decodeLinkCursor(params.cursor);
      if (!cursor) {
        throw new LinkServiceError("VALIDATION_ERROR", "Cursor de paginación inválido", {
          cursor: ["Cursor inválido o corrupto"],
        });
      }
      conditions.push(
        sql`(${links.isPinned} < ${cursor.p} OR (${links.isPinned} = ${cursor.p} AND ${links.id} < ${cursor.id}))`
      );
    }

    if (params.category) {
      const category = LinkCategorySchema.safeParse(params.category);
      if (!category.success) {
        throw new LinkServiceError("VALIDATION_ERROR", "Categoría inválida", {
          category: ["Categoría no reconocida"],
        });
      }
      conditions.push(eq(links.category, category.data));
    }

    const term = params.q?.trim().slice(0, MAX_SEARCH_LENGTH);
    if (term) conditions.push(searchSql(term));

    if (scope === "public") {
      // Aislamiento estricto (RF-019): se fuerza en el servidor, nunca depende del cliente.
      conditions.push(eq(links.isPublic, true), eq(links.isActive, true), notExpiredSql(nowMs));
    } else {
      const statusResult = LinkStatusFilterSchema.safeParse(params.status || "all");
      if (!statusResult.success) {
        throw new LinkServiceError("VALIDATION_ERROR", "Filtro de estado inválido", {
          status: ["Valores permitidos: all, active, inactive, expired, pinned"],
        });
      }
      const status: LinkStatusFilter = statusResult.data;
      if (status === "active") conditions.push(eq(links.isActive, true), notExpiredSql(nowMs));
      if (status === "inactive") conditions.push(eq(links.isActive, false));
      if (status === "expired") conditions.push(expiredSql(nowMs));
      if (status === "pinned") conditions.push(eq(links.isPinned, true));
    }

    const rows = await db
      .select()
      .from(links)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(links.isPinned), desc(links.id))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasNextPage && last ? encodeLinkCursor({ p: last.isPinned ? 1 : 0, id: last.id }) : null;

    return { rows: pageRows, nextCursor, hasNextPage, now };
  }

  async function listLinksPaginated(params: ListLinksParams = {}): Promise<PaginatedResult<LinkDTO>> {
    const page = await queryPage(params, "admin");
    return {
      items: page.rows.map((row) => toLinkDTO(row, page.now)),
      nextCursor: page.nextCursor,
      hasNextPage: page.hasNextPage,
    };
  }

  async function listPublicLinksPaginated(
    params: Omit<ListLinksParams, "status"> = {}
  ): Promise<PaginatedResult<PublicLinkDTO>> {
    const page = await queryPage(params, "public");
    return {
      items: page.rows.map(toPublicLinkDTO),
      nextCursor: page.nextCursor,
      hasNextPage: page.hasNextPage,
    };
  }

  async function getLinkBySlug(slug: string): Promise<LinkDTO | null> {
    const row = await findRowBySlug(slug);
    return row ? toLinkDTO(row) : null;
  }

  return {
    findRowById,
    findRowBySlug,
    getLinkById,
    getLinkBySlug,
    checkSlugAvailability,
    generateUniqueRandomSlug,
    createLink,
    updateLink,
    toggleLinkFlags,
    deleteLink,
    listLinksPaginated,
    listPublicLinksPaginated,
    listPublicLinks: listPublicLinksPaginated,
  };
}

export type LinkService = ReturnType<typeof createLinkService>;
