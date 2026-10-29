import { ArrowLeft, Compass, Link2Off } from "lucide-react";

export default function NotFoundPage() {
  const canonicalUrl = process.env.NEXT_PUBLIC_CANONICAL_URL || "https://cristianarando.dev";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-800/80 text-zinc-300">
          <Link2Off className="h-6 w-6" />
        </div>

        <p className="mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">
          Error 404 · Link Not Found
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          This short link does not exist
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          The route you tried to open is not registered on{" "}
          <span className="font-medium text-zinc-200">cristianarando.dev</span> or has been removed.
        </p>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <a
            href={canonicalUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to portfolio
          </a>
          <a
            href="/links"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            <Compass className="h-4 w-4" />
            Browse /links
          </a>
        </div>
      </div>
    </main>
  );
}
