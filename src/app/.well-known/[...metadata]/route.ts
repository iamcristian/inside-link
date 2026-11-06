import { handleMcpDiscovery } from "@/server/auth/discovery";

export const runtime = "nodejs";

export function GET(request: Request) {
  return handleMcpDiscovery(request);
}
