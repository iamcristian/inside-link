import { afterEach, expect, it, vi } from "vitest";
import { handleMcpDiscovery } from "@/server/auth/discovery";

const resource = "https://example.test/api/v1/mcp/";
const metadataPath = "/.well-known/oauth-authorization-server/api/auth";

afterEach(() => vi.unstubAllEnvs());

it("keeps discovery disabled and unknown paths hidden", async () => {
  vi.stubEnv("MCP_ENABLED", "false");
  const handler = vi.fn();
  const request = new Request(new URL(metadataPath, resource));
  expect((await handleMcpDiscovery(request, undefined, handler)).status).toBe(
    404,
  );
  expect(
    (
      await handleMcpDiscovery(
        new Request(new URL("/.well-known/unknown", resource)),
        resource,
        handler,
      )
    ).status,
  ).toBe(404);
  expect(handler).not.toHaveBeenCalled();
});

it.each([metadataPath, metadataPath + "/"])(
  "publishes the canonical token endpoint at %s",
  async (path) => {
    const original = {
      issuer: "https://example.test/api/auth",
      token_endpoint: "https://example.test/api/auth/oauth2/token",
      scopes_supported: ["links:read"],
    };
    const handler = vi.fn(async (request: Request) => {
      expect(request.url).toBe(new URL(metadataPath, resource).href);
      return Response.json(original, {
        headers: { "Content-Length": "123", "Cache-Control": "no-store" },
      });
    });
    const response = await handleMcpDiscovery(
      new Request(new URL(path, "https://upstream.example.test")),
      resource,
      handler,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ...original,
      token_endpoint: "https://example.test/api/auth/oauth2/token.json",
    });
    expect(handler).toHaveBeenCalledOnce();
  },
);

it("preserves provider errors without manufacturing successful metadata", async () => {
  const failed = Response.json({ error: "unavailable" }, { status: 503 });
  const response = await handleMcpDiscovery(
    new Request(new URL(metadataPath, resource)),
    resource,
    async () => failed,
  );
  expect(response).toBe(failed);
});
