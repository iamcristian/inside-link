import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "./config";
import { createOwnerCheck, getMcpResource } from "./mcp-policy";

export async function requireMcpOwner() {
  const resource = getMcpResource();
  if (!resource) notFound();

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session || !(await createOwnerCheck()(session.user.id))) notFound();
  return { resource, requestHeaders, userId: session.user.id };
}
