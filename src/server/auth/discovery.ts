import {
  isMcpDiscoveryPath,
  MCP_AUTHORIZATION_METADATA_PATH,
} from "@/lib/mcp-discovery";
import { auth } from "./config";
import { getMcpResource, MCP_TOKEN_PATH } from "./mcp-policy";

export async function handleMcpDiscovery(
  request: Request,
  resource = getMcpResource(),
  handler = auth.handler,
) {
  if (!resource) return new Response(null, { status: 404 });

  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (!isMcpDiscoveryPath(path)) return new Response(null, { status: 404 });

  const response = await handler(
    new Request(new URL(path, resource), {
      headers: { accept: "application/json" },
    }),
  );
  if (!response.ok || path !== MCP_AUTHORIZATION_METADATA_PATH) return response;

  // The portfolio adds a trailing slash to extensionless URLs before proxying.
  // OAuth clients must reach the token endpoint without following redirects.
  const metadata = await response.json();
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(
    { ...metadata, token_endpoint: new URL(MCP_TOKEN_PATH, resource).href },
    { status: response.status, headers },
  );
}
