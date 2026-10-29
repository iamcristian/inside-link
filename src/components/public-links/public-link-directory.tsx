"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Lock, Pin, Search, Sparkles } from "lucide-react";
import { LinkIcon } from "@/components/ui/icons";
import { Badge, Input, Skeleton } from "@/components/ui/primitives";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type {
  LinkCategory,
  PaginatedResult,
  PublicLinkDTO,
} from "@/lib/types/link-dto";

const CATEGORY_TABS: { value: LinkCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "project", label: "Projects" },
  { value: "social", label: "Social" },
  { value: "resource", label: "Resources" },
];

export interface PublicLinkDirectoryProps {
  initialPage: PaginatedResult<PublicLinkDTO>;
}

export function PublicLinkDirectory({ initialPage }: PublicLinkDirectoryProps) {
  const [items, setItems] = useState<PublicLinkDTO[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [hasNextPage, setHasNextPage] = useState<boolean>(initialPage.hasNextPage);

  const [category, setCategory] = useState<LinkCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const isFirstRenderRef = useRef(true);

  const buildPublicQueryUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({ limit: "12" });
      if (cursor) params.set("cursor", cursor);
      if (category !== "all") params.set("category", category);
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      return `/api/v1/links/public?${params.toString()}`;
    },
    [category, debouncedQuery]
  );

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const controller = new AbortController();
    setIsInitialLoading(true);

    fetch(buildPublicQueryUrl(null), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const page = (await res.json()) as PaginatedResult<PublicLinkDTO>;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setHasNextPage(page.hasNextPage);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsInitialLoading(false);
        }
      });

    return () => controller.abort();
  }, [buildPublicQueryUrl]);

  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || !nextCursor || isFetchingNextPage || isInitialLoading) {
      return;
    }
    setIsFetchingNextPage(true);
    try {
      const res = await fetch(buildPublicQueryUrl(nextCursor));
      if (!res.ok) return;
      const page = (await res.json()) as PaginatedResult<PublicLinkDTO>;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const nextItems = page.items.filter((i) => !seen.has(i.id));
        return [...prev, ...nextItems];
      });
      setNextCursor(page.nextCursor);
      setHasNextPage(page.hasNextPage);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [hasNextPage, nextCursor, isFetchingNextPage, isInitialLoading, buildPublicQueryUrl]);

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    disabled: isInitialLoading,
    onLoadMore: handleLoadMore,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Link categories">
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.value)}
                className={`rounded-xl px-3.5 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-zinc-100 text-zinc-950 shadow-sm"
                    : "border border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects or resources..."
            aria-label="Search public directory"
            className="pl-9"
          />
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center">
          <p className="text-sm font-medium text-zinc-300">
            No public links found for this filter.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Try selecting another category or clearing the search box.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {items.map((item) => (
              <a
                key={item.id}
                href={`/${item.slug}`}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/90 bg-zinc-900/55 p-4 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/90"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 group-hover:border-emerald-500/40 group-hover:text-emerald-300">
                        <LinkIcon name={item.icon} className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm font-semibold text-zinc-100 group-hover:text-white">
                            {item.title}
                          </h2>
                          {item.isPinned ? (
                            <Pin
                              className="h-3.5 w-3.5 text-emerald-400"
                              aria-label="Featured"
                            />
                          ) : null}
                        </div>
                        <p className="font-mono text-xs text-zinc-500">
                          cristianarando.dev/{item.slug}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.type === "HUB" ? (
                        <Badge variant="success">
                          <Sparkles className="mr-1 h-3 w-3" />
                          HUB
                        </Badge>
                      ) : null}
                      {item.hasPin ? (
                        <Badge variant="warning">
                          <Lock className="mr-1 h-3 w-3" />
                          PIN
                        </Badge>
                      ) : null}
                      <ArrowUpRight className="h-4 w-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-200" />
                    </div>
                  </div>

                  {item.description ? (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                      {item.description}
                    </p>
                  ) : null}
                </div>

                {item.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 pt-2">
                    {item.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-zinc-800/80 bg-zinc-950/70 px-2 py-0.5 font-mono text-[10px] text-zinc-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </a>
            ))}

            {isFetchingNextPage &&
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={`pub-sk-${i}`} className="h-32 w-full" />
              ))}
          </div>

          {hasNextPage && (
            <div ref={sentinelRef} aria-hidden="true" className="h-6 w-full" />
          )}
        </>
      )}
    </div>
  );
}
