import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/server/db/schema";
import { ulid } from "ulidx";

describe("Database Schema & Constraints Integration", () => {
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle>;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    await client.execute("PRAGMA foreign_keys = ON;");
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  });

  it("applies migrations cleanly and creates all tables", async () => {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    );
    const tableNames = tables.rows.map((r) => r.name as string);
    expect(tableNames).toContain("links");
    expect(tableNames).toContain("click_events");
    expect(tableNames).toContain("pin_attempts");
    expect(tableNames).toContain("user");
    expect(tableNames).toContain("session");
  });

  it("enforces CHECK constraints: rejects uppercase slugs", async () => {
    const now = new Date();
    await expect(
      db.insert(schema.links).values({
        id: ulid(),
        slug: "UPPERCASE-SLUG",
        type: "DIRECT",
        destinationUrl: "https://example.com",
        title: "Test Upper",
        createdAt: now,
        updatedAt: now,
      })
    ).rejects.toThrow();
  });

  it("enforces CHECK constraints: rejects DIRECT type without destination_url", async () => {
    const now = new Date();
    await expect(
      db.insert(schema.links).values({
        id: ulid(),
        slug: "test-direct-no-dest",
        type: "DIRECT",
        destinationUrl: null,
        title: "Test Direct Missing Destination",
        createdAt: now,
        updatedAt: now,
      })
    ).rejects.toThrow();
  });

  it("enforces CHECK constraints: rejects invalid redirect_status", async () => {
    const now = new Date();
    await expect(
      db.insert(schema.links).values({
        id: ulid(),
        slug: "test-invalid-status",
        type: "DIRECT",
        destinationUrl: "https://example.com",
        redirectStatus: 999 as any,
        title: "Invalid Status",
        createdAt: now,
        updatedAt: now,
      })
    ).rejects.toThrow();
  });

  it("enforces ON DELETE CASCADE from links to click_events and pin_attempts", async () => {
    const now = new Date();
    const linkId = ulid();

    await db.insert(schema.links).values({
      id: linkId,
      slug: "test-cascade-link",
      type: "DIRECT",
      destinationUrl: "https://example.com",
      title: "Cascade Test",
      createdAt: now,
      updatedAt: now,
    });

    const eventId = ulid();
    await db.insert(schema.clickEvents).values({
      id: eventId,
      linkId: linkId,
      country: "BO",
      clickedAt: now,
    });

    const pinKey = "hash-test-key-123";
    await db.insert(schema.pinAttempts).values({
      key: pinKey,
      linkId: linkId,
      attemptsCount: 1,
      windowExpiresAt: new Date(Date.now() + 60000),
    });

    // Verify records exist
    const eventsBefore = await client.execute({
      sql: "SELECT * FROM click_events WHERE link_id = ?",
      args: [linkId],
    });
    expect(eventsBefore.rows.length).toBe(1);

    const pinsBefore = await client.execute({
      sql: "SELECT * FROM pin_attempts WHERE link_id = ?",
      args: [linkId],
    });
    expect(pinsBefore.rows.length).toBe(1);

    // Delete the link
    await client.execute({
      sql: "DELETE FROM links WHERE id = ?",
      args: [linkId],
    });

    // Verify cascade deleted click_events and pin_attempts
    const eventsAfter = await client.execute({
      sql: "SELECT * FROM click_events WHERE link_id = ?",
      args: [linkId],
    });
    expect(eventsAfter.rows.length).toBe(0);

    const pinsAfter = await client.execute({
      sql: "SELECT * FROM pin_attempts WHERE link_id = ?",
      args: [linkId],
    });
    expect(pinsAfter.rows.length).toBe(0);
  });
});
