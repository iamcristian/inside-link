"use client";

import React, { useEffect, useState } from "react";
import type { LinkDTO } from "@/lib/types/link-dto";
import type {
  AnalyticsRange,
  AnalyticsSummaryDTO,
} from "@/server/services/analytics.service";
import { DialogModal, Skeleton } from "@/components/ui/primitives";
import { AnalyticsOverviewGrid } from "./charts/analytics-charts";

export interface AnalyticsDrawerProps {
  open: boolean;
  link: LinkDTO | null;
  onClose: () => void;
}

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AnalyticsDrawer({ open, link, onClose }: AnalyticsDrawerProps) {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [summary, setSummary] = useState<AnalyticsSummaryDTO | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !link) return;
    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/v1/links/${encodeURIComponent(link.id)}/analytics?range=${range}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { data: AnalyticsSummaryDTO };
        setSummary(json.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [open, link, range]);

  if (!link) return null;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={`Analytics — /${link.slug}`}
      description={link.title}
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-zinc-400">
            {link.shortUrl}
          </span>
          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            {RANGES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  range === opt.value
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading || !summary ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          </div>
        ) : (
          <AnalyticsOverviewGrid summary={summary} />
        )}
      </div>
    </DialogModal>
  );
}
