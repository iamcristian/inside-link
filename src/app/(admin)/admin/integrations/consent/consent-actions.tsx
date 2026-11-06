"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ConsentActions({ signedQuery }: { signedQuery: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function decide(accept: boolean) {
    setSubmitting(true);
    setFailed(false);
    try {
      const { data, error } = await authClient.oauth2.consent({
        accept,
        oauth_query: signedQuery,
      });
      if (error || !data?.url) throw new Error("Consent request failed");
      window.location.assign(data.url);
    } catch {
      setFailed(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void decide(false)}
          className="rounded-md border border-zinc-700 px-4 py-2"
        >
          Deny
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void decide(true)}
          className="rounded-md bg-white px-4 py-2 text-zinc-950"
        >
          Authorize
        </button>
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          Authorization could not be completed. Start again from your MCP
          client.
        </p>
      )}
    </div>
  );
}
