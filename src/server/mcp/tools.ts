import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { LinkCategorySchema } from "@/lib/validations/link.schema";
import { buildOgPresentation, resolveOgImage } from "@/server/og/presentation";
import { OG_WIDTH, OG_HEIGHT } from "@/server/og/card";
import {
  LinkServiceError,
  type LinkService,
  type AnalyticsService,
} from "@/server/services";

const linkId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const idInput = z.strictObject({ id: linkId });
const readOnly = { readOnlyHint: true, openWorldHint: false };

function result(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

function failure(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

async function readData<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (
      error instanceof LinkServiceError &&
      error.code === "VALIDATION_ERROR"
    ) {
      throw new Error(error.message);
    }
    throw new Error("InsideLink could not complete the read.");
  }
}

export function createReadTools(
  links: LinkService,
  analytics?: AnalyticsService,
) {
  return createMcpHandler(
    () => {
      const server = new McpServer({ name: "insidelink", version: "0.1.0" });

      server.registerTool(
        "list_links",
        {
          description:
            "List link summaries with optional filters and cursor pagination.",
          inputSchema: z.strictObject({
            cursor: z.string().max(256).optional(),
            limit: z.number().int().min(1).max(50).optional(),
            q: z.string().max(200).optional(),
            category: z.enum(LinkCategorySchema.options).optional(),
            status: z
              .enum(["all", "active", "inactive", "expired", "pinned"])
              .optional(),
          }),
          annotations: readOnly,
        },
        async (input) => {
          const { items, nextCursor, hasNextPage } = await readData(
            links.listLinksPaginated(input),
          );
          return result({
            items: items.map(
              ({
                id,
                slug,
                shortUrl,
                title,
                type,
                category,
                isActive,
                isPublic,
                isPinned,
                hasPin,
                isExpired,
              }) => ({
                id,
                slug,
                shortUrl,
                title,
                type,
                category,
                isActive,
                isPublic,
                isPinned,
                hasPin,
                isExpired,
              }),
            ),
            nextCursor,
            hasNextPage,
          });
        },
      );

      server.registerTool(
        "get_link",
        {
          description:
            "Read one link by ID, including its destination and configuration.",
          inputSchema: idInput,
          annotations: readOnly,
        },
        async ({ id }) => {
          const link = await readData(links.getLinkById(id));
          return link ? result({ ...link }) : failure("Link not found.");
        },
      );

      server.registerTool(
        "check_slug",
        {
          description:
            "Check whether a slug is valid, reserved or already taken.",
          inputSchema: z.strictObject({
            slug: z.string().min(1).max(200),
            excludeId: linkId.optional(),
          }),
          annotations: readOnly,
        },
        async ({ slug, excludeId }) =>
          result({
            ...(await readData(links.checkSlugAvailability(slug, excludeId))),
          }),
      );

      server.registerTool(
        "get_link_og",
        {
          description: "Get the effective social preview for an active link.",
          inputSchema: idInput,
          annotations: readOnly,
        },
        async ({ id }) => {
          const link = await readData(links.getLinkById(id));
          if (!link?.isActive || link.isExpired)
            return failure("Link is unavailable.");
          const presentation = buildOgPresentation(link);
          const image = resolveOgImage(link, presentation);
          return result({
            ...image,
            alt: presentation.title,
            mode: link.hasPin
              ? "protected"
              : !image.generated
                ? "custom"
                : link.ogMode === "minimal"
                  ? "minimal"
                  : "auto",
            ...(image.generated ? { width: OG_WIDTH, height: OG_HEIGHT } : {}),
          });
        },
      );

      if (analytics) {
        server.registerTool(
          "get_link_analytics",
          {
            description: "Read aggregate click counts for a single link.",
            inputSchema: z.strictObject({
              id: linkId,
              period: z.enum(["7d", "30d", "90d"]).default("30d"),
            }),
            annotations: readOnly,
          },
          async ({ id, period }) => {
            const summary = await readData(
              analytics.getAnalyticsSummary({ linkId: id, range: period }),
            );
            if (!summary) return failure("Link not found.");
            const { allTimeClicks, totalClicksInRange, dailySeries } = summary;
            return result({
              id,
              period,
              allTimeClicks,
              totalClicksInRange,
              dailySeries,
            });
          },
        );
      }

      return server;
    },
    { legacy: "reject", maxRequestBodySize: 16 * 1024, maxSubscriptions: 0 },
  );
}
