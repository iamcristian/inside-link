import { getMcpResource } from "@/server/auth/mcp-policy";
import { createMcpPost } from "@/server/mcp/endpoint";

export const runtime = "nodejs";

const resource = getMcpResource();
const post = resource ? createMcpPost(resource) : null;

export function POST(request: Request) {
  return post ? post(request) : new Response(null, { status: 404 });
}
