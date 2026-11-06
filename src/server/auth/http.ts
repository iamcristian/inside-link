import { readRequestBody } from "@modelcontextprotocol/server";
import { db } from "@/server/db";
import { auth, createAuthInstance } from "./config";
import { getMcpResource, MCP_TOKEN_PATH } from "./mcp-policy";

const providerTokenPath = "/api/auth/oauth2/token";

export async function handleAuthPost(
  request: Request,
  database = db,
  resource = getMcpResource(),
) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!resource || (path !== providerTokenPath && path !== MCP_TOKEN_PATH))
    return auth.handler(request);

  const body = await readRequestBody(request, 16 * 1024);
  if (body.tooLarge) return new Response(null, { status: 413 });

  // Vercel can pass a wrapped Request that the native constructor cannot copy.
  // Resolve the public alias internally, preserving the provider's validation.
  url.pathname = providerTokenPath;
  const tokenRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: body.text,
    signal: request.signal,
  });
  // Serialize issuance and refresh rotation with revocation.
  return database.transaction((transaction) =>
    createAuthInstance(transaction, resource).handler(tokenRequest),
  );
}
