import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";

export const MCP_READ_SCOPE = "links:read";
export const MCP_PATH = "/api/v1/mcp/";

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

export function createOwnerCheck(database: typeof db = db) {
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
