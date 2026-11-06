import { z } from "zod";
import { LinkCategorySchema } from "@/lib/validations/link.schema";
import { assertAdminApiSession } from "@/server/auth/session";
import { buildOgPresentation } from "@/server/og/presentation";
import { respondWithOg } from "@/server/og/response";

export const runtime = "nodejs";

const previewInput = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: z.string().max(500),
    slug: z.string().max(100),
    category: LinkCategorySchema,
    type: z.enum(["DIRECT", "HUB"]),
    ogMode: z.enum(["auto", "custom", "minimal"]),
    hasPin: z.boolean(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await assertAdminApiSession(request.headers);
  if (!auth.authorized) return auth.response;

  const reader = request.body?.getReader();
  const headers = { "Cache-Control": "private, no-store" };
  if (!reader) return new Response(null, { status: 400, headers });

  const decoder = new TextDecoder();
  let body = "";
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      body += decoder.decode(value, { stream: true });
    }
    const input = previewInput.safeParse(JSON.parse(body + decoder.decode()));
    if (!input.success) return new Response(null, { status: 400, headers });
    return respondWithOg(buildOgPresentation(input.data));
  } catch {
    return new Response(null, { status: 400, headers });
  } finally {
    reader.releaseLock();
  }
}
