import { readRequestBody } from "@modelcontextprotocol/server";
import { db } from "@/server/db";
import { auth, createAuthInstance } from "./config";
import { getMcpResource } from "./mcp-policy";

export async function handleAuthPost(
  request: Request,
  database = db,
  resource = getMcpResource(),
) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (!resource || path !== "/api/auth/oauth2/token")
    return auth.handler(request);

  const body = await readRequestBody(request, 16 * 1024);
  if (body.tooLarge) return new Response(null, { status: 413 });

  // Vercel can pass a wrapped Request that the native constructor cannot copy.
  const tokenRequest = new Request(request.url, {
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
