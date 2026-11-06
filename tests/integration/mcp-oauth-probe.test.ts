import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { makeSignature } from "better-auth/crypto";
import { env } from "@/lib/env";
import { createAuthInstance } from "@/server/auth/config";
import * as schema from "@/server/db/schema";
import { expect, it, vi } from "vitest";

const origin = new URL(env.BETTER_AUTH_URL).origin;
const resource = origin + "/api/v1/mcp/";
const callback = "http://127.0.0.1:45678/callback";
const protocolVersion = "2026-07-28";
const scope = "links:read";

it("discovers OAuth and reads a fixture with a resource-bound PKCE token", async () => {
  const client = createClient({ url: ":memory:" });
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
      scopes: [scope, "offline_access"],
      redirectUris: [callback],
      tokenEndpointAuthMethod: "none",
      applicationType: "native",
      requirePKCE: true,
      grantTypes: ["authorization_code", "refresh_token"],
    });
    await database
      .insert(schema.oauthClientResource)
      .values({ id: "client-resource", clientId, resourceId: resource });

    const fetchAuth = (path: string, init?: RequestInit) =>
      auth.handler(new Request(origin + path, init));
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (new URL(request.url).origin !== origin)
        throw new Error("Unexpected external request");
      return auth.handler(request);
    });

    const server = createMcpHandler(
      () => {
        const instance = new McpServer({
          name: "insidelink-probe",
          version: "0.1.0",
        });
        instance.registerTool(
          "read_fixture",
          { description: "Read a local test link" },
          async () => ({
            content: [{ type: "text", text: "https://example.test/fixture" }],
          }),
        );
        return instance;
      },
      { legacy: "reject" },
    );
    const post = requireMcpAuth(auth, (request) => server.fetch(request), {
      resource,
      requiredScopes: [scope],
    });

    const call = (
      method: string,
      params: { name?: string; arguments?: object },
      token?: string,
    ) =>
      post(
        new Request(resource, {
          method: "POST",
          headers: {
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
      scope: scope + " offline_access",
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
    const response = await call(
      "tools/call",
      { name: "read_fixture", arguments: {} },
      accessToken,
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.text()).toContain("https://example.test/fixture");
    expect(refreshToken).toBeTruthy();
    const refresh = (token: string) =>
      fetchAuth("/api/auth/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          resource,
          refresh_token: token,
        }),
      });
    const refreshed = await refresh(refreshToken);
    expect(refreshed.status, await refreshed.clone().text()).toBe(200);
    const rotatedToken = (await refreshed.json()).refresh_token;
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(refreshToken);

    const [grant] = await database.select().from(schema.oauthConsent);
    expect(grant?.userId).toBe(owner.id);
    const revoked = await fetchAuth("/api/auth/oauth2/revoke", {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        token: rotatedToken,
        token_type_hint: "refresh_token",
      }),
    });
    expect(revoked.ok, await revoked.clone().text()).toBe(true);
    expect((await refresh(rotatedToken)).status).toBe(400);
    expect((await exchangeCode()).status).toBe(400);
  } finally {
    vi.unstubAllGlobals();
    client.close();
  }
});
