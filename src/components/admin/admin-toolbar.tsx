"use client";

import React from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { LinkCategory, LinkStatusFilter } from "@/lib/types/link-dto";

export interface AdminToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: LinkCategory | "all";
  onCategoryChange: (cat: LinkCategory | "all") => void;
  selectedStatus: LinkStatusFilter;
  onStatusChange: (status: LinkStatusFilter) => void;
  onCreateClick: () => void;
  totalLoadedCount: number;
}

const CATEGORIES: Array<{ id: LinkCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "project", label: "Projects" },
  { id: "social", label: "Social" },
  { id: "resource", label: "Resources" },
  { id: "personal", label: "Personal" },
  { id: "temporary", label: "Temporary" },
];

const STATUSES: Array<{ id: LinkStatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pinned", label: "Pinned" },
  { id: "inactive", label: "Paused" },
  { id: "expired", label: "Expired" },
];

export function AdminToolbar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  onCreateClick,
  totalLoadedCount,
}: AdminToolbarProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by slug, title, description, or URL..."
            aria-label="Search links"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 py-2 pl-9 pr-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-zinc-500">
            {totalLoadedCount} links in view
          </span>
          <Button onClick={onCreateClick} size="md">
            <Plus className="h-4 w-4" />
            New Link
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-800/70 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition",
                selectedCategory === cat.id
                  ? "bg-white text-zinc-950"
                  : "bg-zinc-950/70 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {STATUSES.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onStatusChange(st.id)}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition",
                selectedStatus === st.id
                  ? "border border-zinc-600 bg-zinc-800 text-white"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
              )}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
