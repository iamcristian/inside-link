import fs from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

if (fs.existsSync(".env")) {
  process.loadEnvFile?.(".env");
}

let globalClient: Client | null = null;

export function getLibsqlClient(): Client {
  if (!globalClient) {
    const url = process.env.TURSO_DATABASE_URL || "file:local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

    globalClient = createClient({
      url,
      authToken,
    });
  }

  return globalClient;
}

export function createDb(client: Client = getLibsqlClient()) {
  return drizzle(client, { schema });
}

export const db = createDb();
export { schema };
