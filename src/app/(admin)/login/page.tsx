"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";

function GitHubIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGitHubLogin = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      if (
        typeof window !== "undefined" &&
        window.location.hostname.endsWith(".vercel.app")
      ) {
        window.location.href = "https://www.cristianarando.dev/login/";
        return;
      }
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/admin/",
      });
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to sign in with GitHub. Access is restricted to the site owner."
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100 selection:bg-zinc-800 selection:text-white">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-800/80 text-white">
            <GitHubIcon className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-white">
            InsideLink Admin
          </h1>
          <p className="mt-2 text-xs text-zinc-400">
            Private link management console for cristianarando.dev
          </p>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleGitHubLogin}
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 shadow-md transition hover:bg-zinc-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
            ) : (
              <GitHubIcon className="h-4 w-4 text-zinc-950" />
            )}
            <span>{isLoading ? "Connecting to GitHub..." : "Continue with GitHub"}</span>
          </button>
        </div>

        <div className="mt-8 border-t border-zinc-800/80 pt-4 text-center">
          <a
            href="https://cristianarando.dev"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to cristianarando.dev
          </a>
        </div>
      </div>
    </div>
  );
}
