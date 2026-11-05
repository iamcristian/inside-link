import { buildProtectedOgPresentation } from "@/server/og/presentation";
import { respondWithOg } from "@/server/og/response";

export const runtime = "nodejs";

export function GET() {
  return respondWithOg(buildProtectedOgPresentation());
}
