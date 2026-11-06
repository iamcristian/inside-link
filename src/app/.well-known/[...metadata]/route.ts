import { isMcpDiscoveryPath } from "@/lib/mcp-discovery";
import { auth } from "@/server/auth/config";
import { getMcpResource } from "@/server/auth/mcp-policy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const resource = getMcpResource();
  if (!resource) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!isMcpDiscoveryPath(path)) return new Response(null, { status: 404 });

  return auth.handler(
    new Request(new URL(path, resource), {
      headers: { accept: "application/json" },
    }),
  );
}
