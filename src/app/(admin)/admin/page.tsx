import React from "react";
import { linkService } from "@/server/services";
import { InfiniteLinkGrid } from "@/components/admin/infinite-link-grid";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const initialPage = await linkService.listLinksPaginated({ limit: 12 });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Links & Micro-Landings Manager
        </h1>
        <p className="text-xs text-zinc-400">
          Manage direct redirects, project HUB pages, and public visibility on cristianarando.dev/links.
        </p>
      </div>

      <InfiniteLinkGrid initialPage={initialPage} />
    </section>
  );
}
