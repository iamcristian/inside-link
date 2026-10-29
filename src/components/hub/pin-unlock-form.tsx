"use client";

import React, { useState } from "react";
import { escapeHtml, getCanonicalBaseUrl } from "@/server/services/og-render.service";

export interface PinUnlockRenderInput {
  slug: string;
  title: string;
  description: string | null;
}

export function renderPinUnlockHtml(input: PinUnlockRenderInput): string {
  const baseUrl = escapeHtml(getCanonicalBaseUrl());
  const slug = escapeHtml(input.slug);
  const title = escapeHtml(input.title);
  const description = escapeHtml(
    input.description || "Enter the access PIN to unlock this protected link."
  );

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title} (PIN Protected) — cristianarando.dev</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fafafa;font-family:system-ui,-apple-system,sans-serif;padding:16px}
    .card{max-width:420px;width:100%;border:1px solid #27272a;background:rgba(24,24,27,.85);border-radius:18px;padding:32px;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.5)}
    .badge{display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid rgba(16,185,129,.35);background:rgba(16,185,129,.1);font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6ee7b7}
    h1{margin:14px 0 8px;font-size:22px;font-weight:600}
    p{margin:0 0 20px;font-size:14px;line-height:1.5;color:#a1a1aa}
    form{display:flex;flex-direction:column;gap:12px}
    input{width:100%;height:42px;border-radius:12px;border:1px solid #3f3f46;background:#09090b;color:#fafafa;padding:0 14px;font-size:15px;text-align:center;letter-spacing:.15em}
    button{height:42px;border-radius:12px;border:none;background:#fafafa;color:#09090b;font-size:14px;font-weight:600;cursor:pointer}
    button:disabled{opacity:.5;cursor:not-allowed}
    .error{font-size:13px;color:#fca5a5;min-height:18px}
    .hub-results{display:none;flex-direction:column;gap:10px;margin-top:16px}
    a.hub-btn{display:flex;justify-content:space-between;padding:12px 16px;border-radius:12px;background:#fafafa;color:#09090b;text-decoration:none;font-size:14px;font-weight:500}
    footer{margin-top:20px;font-size:12px;color:#71717a}
    footer a{color:#a1a1aa;text-decoration:none}
  </style>
</head>
<body>
  <main class="card" data-pin-slug="${slug}">
    <span class="badge">PIN Protected Link</span>
    <h1>${title}</h1>
    <p>${description}</p>
    <form id="pin-form">
      <input
        id="pin-input"
        type="password"
        name="pin"
        placeholder="••••"
        autocomplete="off"
        required
        minlength="4"
        maxlength="64"
        aria-label="Access PIN code"
      />
      <button id="pin-submit" type="submit">Unlock link</button>
      <div id="pin-error" class="error" role="alert"></div>
    </form>
    <div id="hub-container" class="hub-results"></div>
    <footer>
      <a href="${baseUrl}">cristianarando.dev</a>
    </footer>
  </main>
  <script>
    (function(){
      var main = document.querySelector('[data-pin-slug]');
      var form = document.getElementById('pin-form');
      var input = document.getElementById('pin-input');
      var submit = document.getElementById('pin-submit');
      var errorEl = document.getElementById('pin-error');
      var hubContainer = document.getElementById('hub-container');
      if (!main || !form || !input || !submit || !errorEl) return;
      var slug = main.getAttribute('data-pin-slug');
      form.addEventListener('submit', function(e){
        e.preventDefault();
        errorEl.textContent = '';
        submit.disabled = true;
        fetch('/api/v1/slug/' + encodeURIComponent(slug) + '/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: input.value })
        }).then(function(res){
          return res.json().then(function(payload){ return { status: res.status, payload: payload }; });
        }).then(function(result){
          submit.disabled = false;
          if (result.status !== 200) {
            errorEl.textContent = (result.payload && result.payload.error && result.payload.error.message) || 'Invalid PIN';
            return;
          }
          var data = result.payload.data;
          if (data.type === 'DIRECT' && data.destinationUrl) {
            window.location.assign(data.destinationUrl);
          } else if (data.type === 'HUB' && Array.isArray(data.hubLinks) && hubContainer) {
            form.style.display = 'none';
            hubContainer.style.display = 'flex';
            hubContainer.innerHTML = data.hubLinks.map(function(item){
              return '<a class="hub-btn" target="_blank" rel="noopener noreferrer" href="' + item.url + '"><span>' + item.label + '</span><span>↗</span></a>';
            }).join('');
          }
        }).catch(function(){
          submit.disabled = false;
          errorEl.textContent = 'Network error while verifying PIN.';
        });
      });
    })();
  </script>
</body>
</html>`;
}

export function PinUnlockForm({ slug, title, description }: PinUnlockRenderInput) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/slug/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = (await response.json()) as {
        data?: { type: "DIRECT" | "HUB"; destinationUrl?: string; hubLinks?: { id: string; label: string; url: string }[] };
        error?: { message: string };
      };
      if (!response.ok || !json.data) {
        setError(json.error?.message ?? "Invalid PIN");
        return;
      }
      if (json.data.type === "DIRECT" && json.data.destinationUrl) {
        window.location.assign(json.data.destinationUrl);
      }
    } catch {
      setError("Could not verify PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      {description ? <p className="text-sm text-zinc-400">{description}</p> : null}
      <input
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Enter PIN"
        required
        minLength={4}
        maxLength={64}
        className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-center text-sm text-zinc-100"
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="h-10 w-full rounded-xl bg-zinc-100 text-sm font-medium text-zinc-950"
      >
        {submitting ? "Verifying..." : "Unlock link"}
      </button>
    </form>
  );
}
