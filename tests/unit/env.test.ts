import { describe, it, expect } from "vitest";

describe("Environment Validation", () => {
  it("loads and validates required environment variables successfully", async () => {
    const { env } = await import("@/lib/env");
    expect(env.TURSO_DATABASE_URL).toBeDefined();
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.NEXT_PUBLIC_CANONICAL_URL).toBe("https://cristianarando.dev");
  });
});
