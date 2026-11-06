import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db, type AuthDatabase } from "@/server/db";
import { account, oauthClient, oauthConsent } from "@/server/db/schema";

export const MCP_READ_SCOPE = "links:read";
export const MCP_ANALYTICS_SCOPE = "analytics:read";
export const MCP_GRANTS_CLAIM = "insidelink_grants";
export const MCP_PATH = "/api/v1/mcp/";

function storedStrings(value: unknown): string[] {
  // The provider can serialize arrays before the Drizzle JSON column does.
  try {
    const entries: unknown =
      typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(entries) &&
      entries.every((entry) => typeof entry === "string")
      ? entries
      : [];
  } catch {
    return [];
  }
}

export function getMcpResource(): string | undefined {
  if (process.env.MCP_ENABLED !== "true") return undefined;

  const issuer = new URL(env.BETTER_AUTH_URL);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    issuer.hostname,
  );
  if (
    issuer.username ||
    issuer.password ||
    (issuer.protocol !== "https:" && !(issuer.protocol === "http:" && loopback))
  ) {
    throw new Error("MCP requires HTTPS or a loopback HTTP origin.");
  }

  return new URL(MCP_PATH, issuer).href;
}

export function createOwnerCheck(database: AuthDatabase = db) {
  return async (userId: string): Promise<boolean> => {
    const [ownerAccount] = await database
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, "github"),
          eq(account.accountId, env.ALLOWED_GITHUB_ID),
        ),
      )
      .limit(1);
    return Boolean(ownerAccount);
  };
}

export async function getMcpConsents(
  database: AuthDatabase,
  userId: string,
  resource: string,
) {
  const consents = await database
    .select({
      id: oauthConsent.id,
      clientId: oauthConsent.clientId,
      clientName: oauthClient.name,
      resources: oauthConsent.resources,
      scopes: oauthConsent.scopes,
      disabled: oauthClient.disabled,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(eq(oauthConsent.userId, userId))
    .all();
  return consents
    .filter(
      ({ disabled, resources }) =>
        !disabled && storedStrings(resources).includes(resource),
    )
    .map(({ id, clientId, clientName, scopes }) => ({
      id,
      clientId,
      clientName,
      scopes: storedStrings(scopes),
    }))
    .filter(({ scopes }) => scopes.includes(MCP_READ_SCOPE));
}
