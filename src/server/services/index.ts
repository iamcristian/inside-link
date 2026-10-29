import { db } from "../db";
import { createAnalyticsService } from "./analytics.service";
import { createLinkService } from "./link.service";
import { createResolutionService } from "./resolution.service";

export const linkService = createLinkService(db);
export const resolutionService = createResolutionService(db);
export const analyticsService = createAnalyticsService(db);

export * from "./link.service";
export * from "./resolution.service";
export * from "./analytics.service";
