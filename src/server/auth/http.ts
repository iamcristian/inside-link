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

  // Serialize issuance and refresh rotation with revocation after reading the body.
  const tokenRequest = new Request(request, { body: body.text });
  return database.transaction((transaction) =>
    createAuthInstance(transaction, resource).handler(tokenRequest),
  );
}
