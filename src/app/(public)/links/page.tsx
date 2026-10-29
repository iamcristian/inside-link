import React from "react";
import type { Metadata } from "next";
import { ArrowUpRight, Globe } from "lucide-react";
import { PublicLinkDirectory } from "@/components/public-links/public-link-directory";
import { linkService } from "@/server/services";
import { getCanonicalBaseUrl } from "@/server/services/og-render.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Official Links & Projects — Cristian Arando",
  description:
    "Public directory of software projects, repositories, social profiles, and technical resources by Cristian Arando (cristianarando.dev).",
};

export default async function PublicLinksPage() {
  const initialPage = await linkService.listPublicLinks({ limit: 12 });
  const canonicalUrl = getCanonicalBaseUrl();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="mb-10 flex flex-col justify-between gap-4 border-b border-zinc-800/80 pb-8 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              cristianarando.dev/links
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Cristian Arando — Links & Projects
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
              Curated directory of full-stack projects, interactive micro-landings,
              open-source repositories, and verified social profiles.
            </p>
          </div>

          <a
            href={canonicalUrl}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800 sm:self-auto"
          >
            <Globe className="h-4 w-4 text-emerald-400" />
            Main Portfolio
            <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
          </a>
        </header>

        <PublicLinkDirectory initialPage={initialPage} />
      </div>
    </main>
  );
}
