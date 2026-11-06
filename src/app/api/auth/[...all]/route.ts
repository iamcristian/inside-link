import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/config";
import { handleAuthPost } from "@/server/auth/http";

export const { GET } = toNextJsHandler(auth.handler);

export function POST(request: Request) {
  return handleAuthPost(request);
}
