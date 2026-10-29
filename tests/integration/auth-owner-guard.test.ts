import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/server/db/schema";
import { createAuthInstance } from "@/server/auth/config";
import { assertAdminApiSession } from "@/server/auth/session";

describe("Single-Owner GitHub OAuth Guard Integration", () => {
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle>;
  let testAuth: ReturnType<typeof createAuthInstance>;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    await client.execute("PRAGMA foreign_keys = ON;");
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
    testAuth = createAuthInstance(db as any);
  });

  it("rejects unauthorized GitHub account IDs in the hook with 403 FORBIDDEN", async () => {
    const accountHook = testAuth.options.databaseHooks?.account?.create?.before;
    expect(accountHook).toBeDefined();

    if (accountHook) {
      const unauthorizedAccount = {
        id: "acc_intruder",
        accountId: "intruder_id_999999",
        providerId: "github",
        userId: "usr_intruder",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        accountHook(unauthorizedAccount as any)
      ).rejects.toThrow(/Acceso restringido exclusivamente al propietario/);

      // Verify no records inserted
      const count = await client.execute("SELECT count(*) as total FROM account");
      expect(count.rows[0]?.total).toBe(0);
    }
  });

  it("accepts the configured ALLOWED_GITHUB_ID", async () => {
    const accountHook = testAuth.options.databaseHooks?.account?.create?.before;
    expect(accountHook).toBeDefined();

    if (accountHook) {
      const authorizedAccount = {
        id: "acc_owner",
        accountId: process.env.ALLOWED_GITHUB_ID || "12345678",
        providerId: "github",
        userId: "usr_owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await accountHook(authorizedAccount as any);
    }
  });

  it("assertAdminApiSession returns 401 Unauthorized when request lacks a valid session", async () => {
    const emptyHeaders = new Headers();
    const authCheck = await assertAdminApiSession(emptyHeaders);

    expect(authCheck.authorized).toBe(false);
    if (!authCheck.authorized) {
      expect(authCheck.response.status).toBe(401);
      const json = await authCheck.response.json();
      expect(json.error.code).toBe("UNAUTHORIZED");
    }
  });
});
