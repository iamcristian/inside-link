import { and, eq, gte } from "drizzle-orm";
import { clickEvents, links } from "../db/schema";
import type { AppDatabase } from "./link.service";

export type AnalyticsRange = "7d" | "30d" | "90d";

export interface DailySeriesPoint {
  date: string; // YYYY-MM-DD (UTC)
  clicks: number;
}

export interface BreakdownItem {
  key: string;
  count: number;
  percentage: number;
}

export interface AnalyticsSummaryDTO {
  scope: "overview" | "link";
  linkId: string;
  range: AnalyticsRange;
  totalClicksInRange: number;
  allTimeClicks: number;
  dailySeries: DailySeriesPoint[];
  countries: BreakdownItem[];
  devices: BreakdownItem[];
  os: BreakdownItem[];
  browsers: BreakdownItem[];
  referrers: BreakdownItem[];
  queryRefs: BreakdownItem[];
}

function rangeToDays(range: AnalyticsRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "30d":
    default:
      return 30;
  }
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildBreakdown(counts: Map<string, number>, total: number, limit = 10): BreakdownItem[] {
  if (total === 0) return [];
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }));
}

export function createAnalyticsService(db: AppDatabase) {
  async function getAnalyticsSummary(input: {
    linkId: string | "overview";
    range?: AnalyticsRange;
    now?: Date;
  }): Promise<AnalyticsSummaryDTO | null> {
    const range: AnalyticsRange = input.range ?? "30d";
    const days = rangeToDays(range);
    const now = input.now ?? new Date();

    // Inicio del día UTC hace (days - 1) días
    const startUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1), 0, 0, 0, 0)
    );

    let allTimeClicks = 0;
    if (input.linkId === "overview") {
      const allLinks = await db.select({ clicksCount: links.clicksCount }).from(links);
      allTimeClicks = allLinks.reduce((acc, row) => acc + row.clicksCount, 0);
    } else {
      const found = await db
        .select({ id: links.id, clicksCount: links.clicksCount })
        .from(links)
        .where(eq(links.id, input.linkId))
        .limit(1);
      if (!found[0]) {
        return null;
      }
      allTimeClicks = found[0].clicksCount;
    }

    const whereCondition =
      input.linkId === "overview"
        ? gte(clickEvents.clickedAt, startUtc)
        : and(eq(clickEvents.linkId, input.linkId), gte(clickEvents.clickedAt, startUtc));

    const events = await db.select().from(clickEvents).where(whereCondition);

    // Inicializar todos los días del rango en 0 para evitar huecos en la gráfica
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(
        Date.UTC(
          startUtc.getUTCFullYear(),
          startUtc.getUTCMonth(),
          startUtc.getUTCDate() + i,
          0,
          0,
          0
        )
      );
      dailyMap.set(toUtcDateKey(d), 0);
    }

    const countryCounts = new Map<string, number>();
    const deviceCounts = new Map<string, number>();
    const osCounts = new Map<string, number>();
    const browserCounts = new Map<string, number>();
    const referrerCounts = new Map<string, number>();
    const queryRefCounts = new Map<string, number>();

    for (const ev of events) {
      const dayKey = toUtcDateKey(ev.clickedAt);
      dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1);

      const country = ev.country || "XX";
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);

      const device = ev.device || "desktop";
      deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);

      const os = ev.os || "Other";
      osCounts.set(os, (osCounts.get(os) ?? 0) + 1);

      const browser = ev.browser || "Other";
      browserCounts.set(browser, (browserCounts.get(browser) ?? 0) + 1);

      const referrer = ev.referrer || "Direct";
      referrerCounts.set(referrer, (referrerCounts.get(referrer) ?? 0) + 1);

      if (ev.queryParamRef) {
        queryRefCounts.set(ev.queryParamRef, (queryRefCounts.get(ev.queryParamRef) ?? 0) + 1);
      }
    }

    const totalClicksInRange = events.length;
    const dailySeries: DailySeriesPoint[] = Array.from(dailyMap.entries()).map(
      ([date, clicks]) => ({
        date,
        clicks,
      })
    );

    return {
      scope: input.linkId === "overview" ? "overview" : "link",
      linkId: input.linkId,
      range,
      totalClicksInRange,
      allTimeClicks,
      dailySeries,
      countries: buildBreakdown(countryCounts, totalClicksInRange, 10),
      devices: buildBreakdown(deviceCounts, totalClicksInRange, 5),
      os: buildBreakdown(osCounts, totalClicksInRange, 6),
      browsers: buildBreakdown(browserCounts, totalClicksInRange, 6),
      referrers: buildBreakdown(referrerCounts, totalClicksInRange, 10),
      queryRefs: buildBreakdown(queryRefCounts, totalClicksInRange, 10),
    };
  }

  return {
    getAnalyticsSummary,
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
