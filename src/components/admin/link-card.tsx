"use client";

import React, { useState } from "react";
import {
  BarChart3,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Layers,
  Lock,
  Pencil,
  Pin,
  QrCode,
  Trash2,
} from "lucide-react";
import { Badge, Switch } from "@/components/ui/primitives";
import { LinkIcon } from "@/components/ui/icons";
import { cn, formatShortDate } from "@/lib/utils";
import type { LinkDTO } from "@/lib/types/link-dto";

export interface LinkCardProps {
  link: LinkDTO;
  onEdit: (link: LinkDTO) => void;
  onDelete: (link: LinkDTO) => void;
  onToggleFlags: (
    link: LinkDTO,
    patch: { isActive?: boolean; isPinned?: boolean }
  ) => void;
  onOpenQr?: (link: LinkDTO) => void;
  onOpenAnalytics?: (link: LinkDTO) => void;
}

const CATEGORY_LABELS: Record<LinkDTO["category"], string> = {
  project: "Project",
  social: "Social",
  resource: "Resource",
  personal: "Personal",
  temporary: "Temporary",
};

export function LinkCard({
  link,
  onEdit,
  onDelete,
  onToggleFlags,
  onOpenQr,
  onOpenAnalytics,
}: LinkCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback
    }
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border p-4 transition",
        link.isPinned
          ? "border-zinc-700/90 bg-zinc-900/80 shadow-lg"
          : "border-zinc-800/80 bg-zinc-900/45 hover:border-zinc-700/80 hover:bg-zinc-900/70",
        (!link.isActive || link.isExpired) && "opacity-75"
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200">
              <LinkIcon name={link.icon} className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-semibold text-white">
                  {link.title}
                </h3>
                {link.isPinned && (
                  <Pin
                    className="h-3.5 w-3.5 shrink-0 text-amber-400"
                    aria-label="Pinned link"
                  />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy short link"
                  className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs text-zinc-300 hover:text-white"
                >
                  <span className="truncate">
                    cristianarando.dev/{link.slug}
                  </span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-zinc-500 group-hover:text-zinc-300" />
                  )}
                </button>
                <a
                  href={`/${link.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open link in new tab"
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <Switch
            checked={link.isActive}
            onCheckedChange={(checked) =>
              onToggleFlags(link, { isActive: checked })
            }
            ariaLabel={`Toggle active state for ${link.slug}`}
          />
        </div>

        <p className="mt-3 truncate font-mono text-[11px] text-zinc-400">
          {link.type === "HUB"
            ? `Project HUB · ${link.hubLinks?.length ?? 0} buttons configured`
            : link.destinationUrl}
        </p>

        {link.description && (
          <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
            {link.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {link.type === "HUB" ? (
            <Badge variant="purple">
              <Layers className="h-3 w-3" />
              HUB ({link.hubLinks?.length ?? 0})
            </Badge>
          ) : (
            <Badge variant="default">DIRECT {link.redirectStatus}</Badge>
          )}

          <Badge variant="default">{CATEGORY_LABELS[link.category]}</Badge>

          {link.isPublic && (
            <Badge variant="blue">
              <Globe className="h-3 w-3" />
              /links
            </Badge>
          )}

          {link.hasPin && (
            <Badge variant="warning">
              <Lock className="h-3 w-3" />
              PIN
            </Badge>
          )}

          {link.isExpired ? (
            <Badge variant="danger">
              <Clock className="h-3 w-3" />
              Expired
            </Badge>
          ) : link.expiresAt ? (
            <Badge variant="default">
              <Clock className="h-3 w-3" />
              Expires {formatShortDate(link.expiresAt)}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800/70 pt-3">
        <button
          type="button"
          onClick={() => onOpenAnalytics?.(link)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
          title="View link analytics"
        >
          <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
          <span>
            {link.clicksCount}
            {link.maxClicks !== null ? ` / ${link.maxClicks}` : ""} clicks
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleFlags(link, { isPinned: !link.isPinned })}
            title={link.isPinned ? "Unpin from top" : "Pin to top"}
            aria-label={link.isPinned ? "Unpin link" : "Pin link"}
            className={cn(
              "cursor-pointer rounded-lg p-1.5 transition",
              link.isPinned
                ? "bg-amber-950/50 text-amber-300"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>

          {onOpenQr && (
            <button
              type="button"
              onClick={() => onOpenQr(link)}
              title="Generate and download QR code"
              aria-label={`QR code for ${link.slug}`}
              className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(link)}
            title="Edit link"
            aria-label={`Edit ${link.slug}`}
            className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(link)}
            title="Delete link"
            aria-label={`Delete ${link.slug}`}
            className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-950/60 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
