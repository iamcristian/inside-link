"use client";

import React from "react";
import type {
  AnalyticsSummaryDTO,
  BreakdownItem,
  DailySeriesPoint,
} from "@/server/services/analytics.service";

export function DailyClicksBarChart({ series }: { series: DailySeriesPoint[] }) {
  const maxClicks = Math.max(1, ...series.map((d) => d.clicks));

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Daily Clicks Trend (UTC)
        </h4>
        <span className="font-mono text-xs text-zinc-500">
          Peak: {maxClicks} / day
        </span>
      </div>

      <div className="flex h-36 items-end gap-1.5 pt-4">
        {series.map((point) => {
          const heightPct = Math.max(4, Math.round((point.clicks / maxClicks) * 100));
          return (
            <div
              key={point.date}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
              title={`${point.date}: ${point.clicks} clicks`}
            >
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-md transition-all ${
                  point.clicks > 0
                    ? "bg-emerald-500/75 group-hover:bg-emerald-400"
                    : "bg-zinc-800/60"
                }`}
              />
              <span className="mt-1.5 hidden font-mono text-[9px] text-zinc-500 sm:inline">
                {point.date.slice(8)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BreakdownListCard({
  title,
  items,
  emptyLabel = "No events recorded in this period",
}: {
  title: string;
  items: BreakdownItem[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
        {title}
      </h4>

      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-500">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-zinc-200">{item.key}</span>
                <span className="font-mono text-zinc-400">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  style={{ width: `${Math.min(100, Math.max(4, item.percentage))}%` }}
                  className="h-full rounded-full bg-emerald-500/80"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalyticsOverviewGrid({ summary }: { summary: AnalyticsSummaryDTO }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <span className="text-[11px] uppercase tracking-wider text-zinc-400">
            Clicks in range ({summary.range})
          </span>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {summary.totalClicksInRange.toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <span className="text-[11px] uppercase tracking-wider text-zinc-400">
            All-Time Clicks
          </span>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-400">
            {summary.allTimeClicks.toLocaleString("en-US")}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 sm:col-span-1">
          <span className="text-[11px] uppercase tracking-wider text-zinc-400">
            Top Country
          </span>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-100">
            {summary.countries[0]?.key ?? "—"}
          </p>
        </div>
      </div>

      <DailyClicksBarChart series={summary.dailySeries} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownListCard title="Top Countries (ISO)" items={summary.countries} />
        <BreakdownListCard title="Traffic Sources / Referrers" items={summary.referrers} />
        <BreakdownListCard title="Devices" items={summary.devices} />
        <BreakdownListCard title="Operating Systems" items={summary.os} />
      </div>
    </div>
  );
}
