import { requireMcpAuth } from "@better-auth/mcp";
import { createInsufficientScopeError } from "better-auth/oauth2";
import { auth } from "@/server/auth/config";
import {
  createOwnerCheck,
  getMcpConsents,
  MCP_ANALYTICS_SCOPE,
  MCP_GRANTS_CLAIM,
  MCP_READ_SCOPE,
} from "@/server/auth/mcp-policy";
import { db } from "@/server/db";
import { createAnalyticsService, createLinkService } from "@/server/services";
import { createReadTools } from "./tools";

export function createMcpPost(
  resource: string,
  provider = auth,
  database = db,
) {
  const isOwner = createOwnerCheck(database);
  const origin = new URL(resource).origin;
  const links = createLinkService(database);
  const basicTools = createReadTools(links);
  const extendedTools = createReadTools(
    links,
    createAnalyticsService(database),
  );
  const headers = { "Cache-Control": "no-store" };
  const forbidden = () => new Response(null, { status: 403, headers });

  const protectedPost = requireMcpAuth(
    provider,
    async (request, claims) => {
      const { sub, client_id: clientId, scope } = claims;
      const grantIds = claims[MCP_GRANTS_CLAIM];
      if (
        typeof sub !== "string" ||
        typeof clientId !== "string" ||
        !Array.isArray(grantIds) ||
        !(await isOwner(sub))
      )
        return forbidden();

      const grants = await getMcpConsents(database, sub, resource);
      const grant = grants.find(
        ({ id, clientId: grantedClient }) =>
          grantedClient === clientId && grantIds.includes(id),
      );
      if (!grant) return forbidden();

      const canReadAnalytics =
        typeof scope === "string" &&
        scope.split(" ").includes(MCP_ANALYTICS_SCOPE) &&
        grant.scopes.includes(MCP_ANALYTICS_SCOPE);
      if (
        request.headers.get("Mcp-Name") === "get_link_analytics" &&
        !canReadAnalytics
      ) {
        throw createInsufficientScopeError([MCP_ANALYTICS_SCOPE]);
      }

      const handler = canReadAnalytics ? extendedTools : basicTools;
      return handler.fetch(request);
    },
    { resource, requiredScopes: [MCP_READ_SCOPE] },
  );

  return async (request: Request) => {
    const requestOrigin = request.headers.get("Origin");
    if (requestOrigin !== null && requestOrigin !== origin) return forbidden();

    const response = await protectedPost(request);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  };
}
