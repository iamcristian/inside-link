import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { disconnectMcpClient } from "@/server/auth/mcp-connections";
import { getMcpConsents } from "@/server/auth/mcp-policy";
import { requireMcpOwner } from "@/server/auth/mcp-session";

export default async function IntegrationsPage() {
  const { resource, userId } = await requireMcpOwner();
  const grants = await getMcpConsents(db, userId, resource);

  async function disconnect(form: FormData) {
    "use server";

    const { resource, userId } = await requireMcpOwner();
    const consentId = form.get("consentId");
    if (typeof consentId !== "string" || consentId.length > 128) return;

    await disconnectMcpClient(db, resource, userId, consentId);
    revalidatePath("/admin/integrations");
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">MCP integrations</h1>
        <p className="mt-2 break-all text-sm text-zinc-400">{resource}</p>
      </div>
      {grants.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
          No connected MCP clients.
        </p>
      ) : (
        <ul className="space-y-3">
          {grants.map(({ id, clientId, clientName, scopes }) => (
            <li
              key={id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="min-w-0">
                <p className="break-all font-medium">
                  {clientName || clientId}
                </p>
                {clientName && (
                  <p className="break-all text-xs text-zinc-400">{clientId}</p>
                )}
                <p className="mt-2 text-xs text-zinc-400">
                  {scopes.join(" · ")}
                </p>
              </div>
              <form action={disconnect}>
                <input type="hidden" name="consentId" value={id} />
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  Disconnect
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
