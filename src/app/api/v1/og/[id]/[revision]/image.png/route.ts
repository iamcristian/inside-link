import { handleOgGet } from "@/server/og/response";
import { linkService } from "@/server/services";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; revision: string }> },
) {
  const { id, revision } = await context.params;
  return handleOgGet(request, id, revision, linkService);
}
