import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp, requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { jwt } from "better-auth/plugins";
import { expect, it, vi } from "vitest";

const origin = "http://localhost:3000";
const resource = origin + "/api/v1/mcp/";
const callback = "http://127.0.0.1:45678/callback";
const protocolVersion = "2026-07-28";
const scope = "links:read";

it("discovers OAuth and reads a fixture with a resource-bound PKCE token", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    const options = {
      database,
      baseURL: origin,
      secret: "isolated-mcp-test-secret-not-for-production",
      emailAndPassword: { enabled: true },
      disabledPaths: ["/token"],
      plugins: [
        jwt({ disableSettingJwtHeader: true }),
        mcp({
          resource,
          loginPage: "/login",
          consentPage: "/consent",
          scopes: [scope],
        }),
        cimd({
          fetchClientMetadataResource,
          metadataProfile: "mcp-2026-07-28",
        }),
      ],
    };
    await (await getMigrations(options)).runMigrations();
    const auth = betterAuth(options);

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

    const signUp = await auth.api.signUpEmail({
      asResponse: true,
      body: {
        email: "owner@example.test",
        name: "Test owner",
        password: "fixture-password",
      },
    });
    expect(signUp.ok).toBe(true);
    const sessionCookie = signUp.headers
      .getSetCookie()
      .find((cookie) => cookie.includes("session_token="))
      ?.split(";")[0];
    expect(sessionCookie).toBeDefined();

    const registered = await auth.api.adminCreateOAuthClient({
      headers: new Headers({ Cookie: sessionCookie! }),
      body: {
        redirect_uris: [callback],
        token_endpoint_auth_method: "none",
        application_type: "native",
        scope,
        resources: [resource],
        require_pkce: true,
        skip_consent: true,
      },
    });
    const verifier = "test-code-verifier-that-is-long-enough-for-pkce";
    const query = new URLSearchParams({
      client_id: registered.client_id,
      redirect_uri: callback,
      response_type: "code",
      scope,
      state: "test-state",
      resource,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    });
    const authorization = await fetchAuth(
      "/api/auth/oauth2/authorize?" + query,
      {
        headers: { Cookie: sessionCookie! },
      },
    );
    const redirect = new URL(
      authorization.headers.get("location") ?? "/",
      origin,
    );
    expect(redirect.origin + redirect.pathname).toBe(callback);
    expect(redirect.searchParams.get("state")).toBe("test-state");
    const code = redirect.searchParams.get("code");
    expect(code).toBeTruthy();

    const exchangeCode = () =>
      fetchAuth("/api/auth/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: registered.client_id,
          redirect_uri: callback,
          resource,
          code: code!,
          code_verifier: verifier,
        }),
      });
    const tokenResponse = await exchangeCode();
    expect(tokenResponse.status).toBe(200);
    const { access_token: accessToken } = await tokenResponse.json();
    expect((await exchangeCode()).status).toBe(400);
    expect((await call("tools/list", {}, "invalid-token")).status).toBe(401);
    const response = await call(
      "tools/call",
      { name: "read_fixture", arguments: {} },
      accessToken,
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.text()).toContain("https://example.test/fixture");
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
