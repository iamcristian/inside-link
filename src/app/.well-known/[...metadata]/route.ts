import { auth } from "@/server/auth/config";
import { getMcpResource } from "@/server/auth/mcp-policy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const resource = getMcpResource();
  if (!resource) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const resourcePath = new URL(resource).pathname.replace(/\/+$/, "");
  const discoveryPaths = [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource" + resourcePath,
    "/.well-known/oauth-authorization-server/api/auth",
  ];
  if (!discoveryPaths.includes(path))
    return new Response(null, { status: 404 });

  return auth.handler(
    new Request(new URL(path, resource), {
      headers: { accept: "application/json" },
    }),
  );
}
