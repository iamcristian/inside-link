/**
 * Contratos de transferencia (DTO) de enlaces.
 * Tipos puros, seguros para importar desde componentes cliente.
 * Nunca incluyen `password_hash` ni otros campos sensibles de la fila de BD.
 */
import type { HubLinkItem } from "../validations/link.schema";

export type LinkType = "DIRECT" | "HUB";
export type LinkCategory = "social" | "project" | "resource" | "personal" | "temporary";
export type LinkStatusFilter = "all" | "active" | "inactive" | "expired" | "pinned";

/** Vista completa para el panel /admin. */
export interface LinkDTO {
  id: string;
  slug: string;
  shortUrl: string;
  type: LinkType;
  destinationUrl: string | null;
  redirectStatus: number;
  forwardQueryParams: boolean;
  hubLinks: HubLinkItem[] | null;
  title: string;
  description: string | null;
  ogImageUrl: string | null;
  category: LinkCategory;
  tags: string[];
  icon: string;
  isActive: boolean;
  isPublic: boolean;
  isPinned: boolean;
  hasPin: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
  clicksCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Vista reducida para el directorio público /links (sin destino, límites ni métricas). */
export interface PublicLinkDTO {
  id: string;
  slug: string;
  shortUrl: string;
  type: LinkType;
  title: string;
  description: string | null;
  category: LinkCategory;
  tags: string[];
  icon: string;
  isPinned: boolean;
  hasPin: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface SlugAvailability {
  available: boolean;
  normalizedSlug: string;
  reason?: "RESERVED" | "INVALID" | "TAKEN";
  message?: string;
}
