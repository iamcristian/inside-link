import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Clock,
  FolderGit2,
  Globe,
  LayoutDashboard,
  Lock,
  ShieldCheck,
} from "lucide-react";

const PREVIEW_ROUTES = [
  {
    href: "/admin",
    title: "Admin Dashboard (/admin)",
    badge: "Admin · Infinite Scroll",
    description:
      "Grid with 18 seeded links, debounced search, live slug validation, custom QR code generator (SVG/PNG), and per-link analytics drawer.",
    icon: LayoutDashboard,
    accent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  {
    href: "/admin/analytics",
    title: "Global Analytics (/admin/analytics)",
    badge: "Telemetry · 120 Events",
    description:
      "Daily click trends (7d / 30d / 90d), top countries, devices, operating systems, and traffic referrers.",
    icon: BarChart3,
    accent: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  },
  {
    href: "/links",
    title: "Public Directory (/links)",
    badge: "Public · Bio / Projects",
    description:
      "Public link directory for Cristian Arando with category tabs (Projects, Social, Resources), instant search, and Infinite Scroll.",
    icon: Globe,
    accent: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  },
  {
    href: "/proyecto-guia-turistica",
    title: "Project Micro-Landing (/proyecto-guia-turistica)",
    badge: "HUB Mode · Project",
    description:
      "Interactive project micro-landing page with multiple action buttons (GitHub Repository, Live Demo, and Documentation).",
    icon: FolderGit2,
    accent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  {
    href: "/presupuesto-confidencial",
    title: "PIN-Protected Link (/presupuesto-confidencial)",
    badge: "Demo PIN: 1234",
    description:
      "Secure interstitial protected with scrypt and rate limiting (max 5 attempts / 60s). Enter PIN 1234 to test unlocking.",
    icon: Lock,
    accent: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  {
    href: "/enlace-expirado",
    title: "Expired Link View (/enlace-expirado)",
    badge: "HTTP 410 Gone",
    description:
      "Dedicated 410 Gone status screen displayed when a link passes its expiration date or reaches its maximum click limit.",
    icon: Clock,
    accent: "border-red-500/40 bg-red-500/10 text-red-300",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-50 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-3 border-b border-zinc-800/80 pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Local Environment Active · SQLite (18 links + 120 clicks seeded)
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            InsideLink — <span className="text-zinc-400">cristianarando.dev</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
            Local preview hub. Explore all public views, <code className="font-mono text-zinc-200">HUB</code>{" "}
            project micro-landings, PIN unlock flows, and the admin dashboard before connecting production accounts.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PREVIEW_ROUTES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col justify-between rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 group-hover:border-zinc-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${item.accent}`}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">
                      {item.title}
                    </h2>
                    <ArrowUpRight className="h-4 w-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                  </div>

                  <p className="text-xs leading-relaxed text-zinc-400">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-zinc-800/60 pt-3 font-mono text-xs text-zinc-500 group-hover:text-zinc-300">
                  http://localhost:3000{item.href}
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
