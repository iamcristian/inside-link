"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { AnalyticsOverviewGrid } from "@/components/admin/charts/analytics-charts";
import { Skeleton } from "@/components/ui/primitives";
import type {
  AnalyticsRange,
  AnalyticsSummaryDTO,
} from "@/server/services/analytics.service";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export default function GlobalAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [summary, setSummary] = useState<AnalyticsSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/v1/links/overview/analytics?range=${range}`, {
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
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="space-y-1">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to link manager
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Global Telemetry & Analytics
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Privacy-first aggregated metrics stored in Turso without tracking cookies or raw IP addresses.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/90 p-1">
          {RANGES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      ) : (
        <AnalyticsOverviewGrid summary={summary} />
      )}
    </div>
  );
}
