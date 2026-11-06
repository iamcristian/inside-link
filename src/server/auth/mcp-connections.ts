import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  oauthAccessToken,
  oauthConsent,
  oauthRefreshToken,
} from "@/server/db/schema";
import { createOwnerCheck, getMcpConsents } from "./mcp-policy";

export async function disconnectMcpClient(
  database: typeof db,
  resource: string,
  userId: string,
  consentId: string,
) {
  return database.transaction(async (transaction) => {
    if (!(await createOwnerCheck(transaction)(userId))) return false;

    const consents = await getMcpConsents(transaction, userId, resource);
    const grant = consents.find(({ id }) => id === consentId);
    if (!grant) return false;

    await transaction
      .delete(oauthConsent)
      .where(
        and(
          eq(oauthConsent.userId, userId),
          eq(oauthConsent.clientId, grant.clientId),
        ),
      );
    await transaction
      .delete(oauthAccessToken)
      .where(
        and(
          eq(oauthAccessToken.userId, userId),
          eq(oauthAccessToken.clientId, grant.clientId),
        ),
      );
    await transaction
      .delete(oauthRefreshToken)
      .where(
        and(
          eq(oauthRefreshToken.userId, userId),
          eq(oauthRefreshToken.clientId, grant.clientId),
        ),
      );
    return true;
  });
}
