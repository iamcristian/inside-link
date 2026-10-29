import { migrate } from "drizzle-orm/libsql/migrator";
import { db, getLibsqlClient } from "./index";

export async function runMigrations() {
  const client = getLibsqlClient();
  await client.execute("PRAGMA foreign_keys = ON;");
  console.log("Applying database migrations...");
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  console.log("Migrations applied successfully.");
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
