import React from "react";
import { BarChart3, ExternalLink, Link2, ShieldCheck } from "lucide-react";
import { requireAdminSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionData = await requireAdminSession();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <a
              href="/admin"
              className="flex items-center gap-2 text-sm font-semibold text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900">
                <Link2 className="h-4 w-4 text-white" />
              </span>
              <span>InsideLink</span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                cristianarando.dev
              </span>
            </a>

            <nav className="hidden items-center gap-1 sm:flex">
              <a
                href="/admin"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                Links
              </a>
              <a
                href="/admin/analytics"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </a>
              <a
                href="/links"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                Public /links
                <ExternalLink className="h-3 w-3" />
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">{sessionData.user.email}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
