import { notFound } from "next/navigation";
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { auth } from "@/server/auth/config";
import { MCP_ANALYTICS_SCOPE, MCP_READ_SCOPE } from "@/server/auth/mcp-policy";

import { requireMcpOwner } from "@/server/auth/mcp-session";
import { ConsentActions } from "./consent-actions";

const scopeLabels = {
  [MCP_READ_SCOPE]: "Read link metadata and destinations in InsideLink",
  [MCP_ANALYTICS_SCOPE]: "Read aggregate click statistics",
  offline_access: "Keep this connection authorized between sessions",
};

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { requestHeaders } = await requireMcpOwner();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value]) {
      params.append(key, entry);
    }
  }

  const signedKeys = new Set(["sig", "ba_param", ...params.getAll("ba_param")]);
  const query = new URLSearchParams(
    [...params].filter(([key]) => signedKeys.has(key)),
  );
  const signedQuery = query.toString();
  const { secret } = await auth.$context;
  if (!(await verifyOAuthQueryParams(signedQuery, secret))) notFound();

  const clientId = query.get("client_id");
  const callback = query.get("redirect_uri");
  const requestedScopes = (query.get("scope") ?? "").split(" ").filter(Boolean);
  if (!clientId || !callback) notFound();

  const client = await auth.api
    .getOAuthClientPublic({
      query: { client_id: clientId },
      headers: requestHeaders,
    })
    .catch(() => null);
  if (!client) notFound();

  return (
    <section className="mx-auto mt-12 max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h1 className="text-xl font-semibold">Authorize an MCP client</h1>
      <p className="mt-3 break-all text-sm text-zinc-300">
        {client.client_name || clientId}
      </p>
      <p className="mt-1 text-sm text-zinc-400">
        Callback host: {new URL(callback).host}
      </p>
      <ul className="mt-4 list-inside list-disc text-sm text-zinc-300">
        {requestedScopes.map((scope) => (
          <li key={scope}>
            {scopeLabels[scope as keyof typeof scopeLabels] ?? scope}
          </li>
        ))}
      </ul>
      <ConsentActions signedQuery={signedQuery} />
    </section>
  );
}
