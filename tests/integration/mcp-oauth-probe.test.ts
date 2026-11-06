import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { makeSignature } from "better-auth/crypto";
import { env } from "@/lib/env";
import { disconnectMcpClient } from "@/server/auth/mcp-connections";
import { handleAuthPost } from "@/server/auth/http";
import { createAuthInstance } from "@/server/auth/config";
import { createMcpPost } from "@/server/mcp/endpoint";
import { createLinkService } from "@/server/services/link.service";
import * as schema from "@/server/db/schema";
import { expect, it, vi } from "vitest";

const origin = new URL(env.BETTER_AUTH_URL).origin;
const resource = origin + "/api/v1/mcp/";
const callback = "http://127.0.0.1:45678/callback";
const protocolVersion = "2026-07-28";
const scope = "links:read";
const analyticsScope = "analytics:read";

it("reads InsideLink data with a resource-bound PKCE token and enforces revocation", async () => {
  const client = createClient({ url: "file::memory:?cache=shared" });
  const database = drizzle(client, { schema });
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    await migrate(database, { migrationsFolder: "src/server/db/migrations" });
    const auth = createAuthInstance(database, resource);
    const ctx = await auth.$context;
    const now = new Date();
    const owner = {
      id: "owner",
      name: "Test Owner",
      email: "owner@example.test",
      createdAt: now,
      updatedAt: now,
    };
    const other = { ...owner, id: "other", email: "other@example.test" };
    await database.insert(schema.user).values([owner, other]);
    await database.insert(schema.account).values({
      id: "owner-github",
      userId: owner.id,
      accountId: env.ALLOWED_GITHUB_ID,
      providerId: "github",
      createdAt: now,
      updatedAt: now,
    });
    const sessionHeaders = async (userId: string) => {
      const session = await ctx.internalAdapter.createSession(userId);
      const signature = await makeSignature(session.token, ctx.secret);
      return new Headers({
        Cookie:
          ctx.authCookies.sessionToken.name +
          "=" +
          session.token +
          "." +
          signature,
      });
    };
    const ownerHeaders = await sessionHeaders(owner.id);
    const otherHeaders = await sessionHeaders(other.id);
    const clientId = "test-mcp-client";
    await database.insert(schema.oauthClient).values({
      id: "test-client",
      clientId,
      scopes: [scope, analyticsScope, "offline_access"],
      redirectUris: [callback],
      tokenEndpointAuthMethod: "none",
      applicationType: "native",
      requirePKCE: true,
      grantTypes: ["authorization_code", "refresh_token"],
    });
    await database
      .insert(schema.oauthClientResource)
      .values({ id: "client-resource", clientId, resourceId: resource });

    const fetchAuth = (path: string, init?: RequestInit) => {
      const request = new Request(origin + path, init);
      return path === "/api/auth/oauth2/token"
        ? handleAuthPost(request, database, resource)
        : auth.handler(request);
    };
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (new URL(request.url).origin !== origin)
        throw new Error("Unexpected external request");
      return auth.handler(request);
    });

    const post = createMcpPost(resource, auth, database);
    const link = await createLinkService(database).createLink({
      slug: "mcp-fixture",
      title: "Private fixture",
      destinationUrl: "https://example.test/fixture",
      pin: "1234",
    });

    const call = (
      method: string,
      params: { name?: string; arguments?: object },
      token?: string,
      requestOrigin?: string,
    ) =>
      post(
        new Request(resource, {
          method: "POST",
          headers: {
            ...(requestOrigin ? { Origin: requestOrigin } : {}),
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": protocolVersion,
            "Mcp-Method": method,
            ...(params.name ? { "Mcp-Name": params.name } : {}),
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method,
            params: {
              ...params,
              _meta: {
                "io.modelcontextprotocol/protocolVersion": protocolVersion,
                "io.modelcontextprotocol/clientCapabilities": {},
              },
            },
          }),
        }),
      );
    const denied = await call("tools/list", {});
    expect(denied.status).toBe(401);
    const challenge = denied.headers.get("www-authenticate") ?? "";
    const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
    expect(metadataUrl).toBeDefined();
    const metadataResponse = await auth.handler(new Request(metadataUrl!));
    expect(metadataResponse.status).toBe(200);
    expect(await metadataResponse.json()).toMatchObject({
      resource,
      authorization_servers: [origin + "/api/auth"],
    });
    const discovery = await fetchAuth(
      "/.well-known/oauth-authorization-server/api/auth",
    );
    expect(discovery.status).toBe(200);
    const discoveryBody = await discovery.json();
    expect(discoveryBody).toMatchObject({
      issuer: origin + "/api/auth",
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
    });
    expect(discoveryBody).not.toHaveProperty("registration_endpoint");

    const verifier = "test-code-verifier-that-is-long-enough-for-pkce";
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      response_type: "code",
      scope: [scope, analyticsScope, "offline_access"].join(" "),
      state: "test-state",
      resource,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    });
    const authorizePath = "/api/auth/oauth2/authorize?" + query;
    const guest = await fetchAuth(authorizePath);
    expect(new URL(guest.headers.get("location")!, origin).pathname).toBe(
      "/login/",
    );
    expect(
      (await fetchAuth(authorizePath, { headers: otherHeaders })).status,
    ).toBe(403);
    const authorization = await fetchAuth(authorizePath, {
      headers: ownerHeaders,
    });
    const consentPage = new URL(authorization.headers.get("location")!, origin);
    expect(consentPage.pathname).toBe("/admin/integrations/consent/");
    const consentResponse = await fetchAuth("/api/auth/oauth2/consent", {
      method: "POST",
      headers: new Headers({
        Cookie: ownerHeaders.get("cookie")!,
        Origin: origin,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        accept: true,
        oauth_query: consentPage.search.slice(1),
      }),
    });
    expect(consentResponse.ok, await consentResponse.clone().text()).toBe(true);
    const consent = await consentResponse.json();
    const redirect = new URL(consent.url, origin);
    expect(redirect.origin + redirect.pathname).toBe(callback);
    expect(redirect.searchParams.get("state")).toBe("test-state");
    const code = redirect.searchParams.get("code");
    expect(code).toBeTruthy();

    const exchangeCode = () =>
      fetchAuth("/api/auth/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          redirect_uri: callback,
          resource,
          code: code!,
          code_verifier: verifier,
        }),
      });
    const tokenResponse = await exchangeCode();
    expect(tokenResponse.status).toBe(200);
    const { access_token: accessToken, refresh_token: refreshToken } =
      await tokenResponse.json();
    expect((await call("tools/list", {}, "invalid-token")).status).toBe(401);
    expect(
      (await call("tools/list", {}, accessToken, "https://other.test")).status,
    ).toBe(403);
    const toolsResponse = await call("tools/list", {}, accessToken);
    expect(toolsResponse.status).toBe(200);
    expect(toolsResponse.headers.get("cache-control")).toBe("no-store");
    const tools = (await toolsResponse.json()).result.tools;
    expect(tools.map(({ name }: { name: string }) => name).sort()).toEqual([
      "check_slug",
      "get_link",
      "get_link_analytics",
      "get_link_og",
      "list_links",
    ]);

    const read = (name: string, args: object) =>
      call("tools/call", { name, arguments: args }, accessToken);
    const detail = await read("get_link", { id: link.id });
    expect(detail.status).toBe(200);
    const details = (await detail.json()).result.structuredContent;
    expect(details).toMatchObject({
      destinationUrl: "https://example.test/fixture",
      hasPin: true,
    });
    expect(details).not.toHaveProperty("passwordHash");

    const page = (await (await read("list_links", { limit: 1 })).json()).result
      .structuredContent;
    expect(page.items[0]).toMatchObject({ id: link.id, slug: link.slug });
    expect(page.items[0]).not.toHaveProperty("destinationUrl");
    const slug = (await (await read("check_slug", { slug: link.slug })).json())
      .result.structuredContent;
    expect(slug).toMatchObject({ available: false });
    const og = (await (await read("get_link_og", { id: link.id })).json())
      .result.structuredContent;
    expect(og).toMatchObject({ mode: "protected", width: 1200, height: 630 });
    const analytics = (
      await (await read("get_link_analytics", { id: link.id })).json()
    ).result.structuredContent;
    expect(analytics).toMatchObject({
      id: link.id,
      period: "30d",
      allTimeClicks: 0,
    });
    expect(analytics).not.toHaveProperty("queryRefs");
    expect(refreshToken).toBeTruthy();
    const refresh = (token: string, requestedScope?: string) =>
      fetchAuth("/api/auth/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          resource,
          refresh_token: token,
          ...(requestedScope ? { scope: requestedScope } : {}),
        }),
      });
    const refreshed = await refresh(refreshToken, scope + " offline_access");
    expect(refreshed.status, await refreshed.clone().text()).toBe(200);
    const { refresh_token: rotatedToken, access_token: readOnlyToken } =
      await refreshed.json();
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(refreshToken);
    const limited = await call(
      "tools/call",
      { name: "get_link_analytics", arguments: { id: link.id } },
      readOnlyToken,
    );
    expect(limited.status).toBe(403);
    expect(limited.headers.get("www-authenticate")).toContain(
      "insufficient_scope",
    );

    const [grant] = await database.select().from(schema.oauthConsent);
    expect(grant?.userId).toBe(owner.id);
    expect(
      await disconnectMcpClient(database, resource, other.id, grant!.id),
    ).toBe(false);
    expect(
      await disconnectMcpClient(database, resource, owner.id, grant!.id),
    ).toBe(true);
    expect(await database.select().from(schema.oauthConsent)).toEqual([]);
    expect(await database.select().from(schema.oauthRefreshToken)).toEqual([]);
    expect((await call("tools/list", {}, accessToken)).status).toBe(403);
    expect((await refresh(rotatedToken)).status).toBe(400);

    await database
      .insert(schema.oauthConsent)
      .values({ ...grant!, id: "new-consent" });
    expect((await call("tools/list", {}, accessToken)).status).toBe(403);
    expect((await refresh(rotatedToken)).status).toBe(400);
    expect((await exchangeCode()).status).toBe(400);
  } finally {
    vi.unstubAllGlobals();
    client.close();
  }
});
