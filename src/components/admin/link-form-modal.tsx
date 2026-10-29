"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button, DialogModal, Input, Switch } from "@/components/ui/primitives";
import { IconPicker } from "./icon-picker";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { classifySlug, normalizeSlug } from "@/lib/validations/slug.schema";
import type { HubLinkItem } from "@/lib/validations/link.schema";
import type { LinkCategory, LinkDTO, LinkType, SlugAvailability } from "@/lib/types/link-dto";

export interface LinkFormModalProps {
  open: boolean;
  initialLink?: LinkDTO | null;
  onClose: () => void;
  onSaved: (saved: LinkDTO, isEdit: boolean) => void;
}

const DEFAULT_HUB_ITEMS: HubLinkItem[] = [
  {
    id: "repo",
    label: "View GitHub Repository",
    url: "https://github.com/cristianarando/",
    icon: "github",
    variant: "primary",
  },
  {
    id: "demo",
    label: "View Live Demo",
    url: "https://cristianarando.dev",
    icon: "external-link",
    variant: "secondary",
  },
];

export function LinkFormModal({
  open,
  initialLink,
  onClose,
  onSaved,
}: LinkFormModalProps) {
  const isEdit = Boolean(initialLink);

  const [slugInput, setSlugInput] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<LinkType>("DIRECT");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [redirectStatus, setRedirectStatus] = useState<307 | 301>(307);
  const [forwardQueryParams, setForwardQueryParams] = useState(true);
  const [hubLinks, setHubLinks] = useState<HubLinkItem[]>(DEFAULT_HUB_ITEMS);
  const [category, setCategory] = useState<LinkCategory>("project");
  const [tagsText, setTagsText] = useState("");
  const [icon, setIcon] = useState("link");
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [clearExistingPin, setClearExistingPin] = useState(false);
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [maxClicksInput, setMaxClicksInput] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");

  const [slugStatus, setSlugStatus] = useState<
    | { state: "idle" }
    | { state: "checking"; normalized: string }
    | { state: "available"; normalized: string }
    | { state: "blocked"; normalized: string; message: string }
  >({ state: "idle" });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setClearExistingPin(false);
    setPinInput("");

    if (initialLink) {
      setSlugInput(initialLink.slug);
      setTitle(initialLink.title);
      setDescription(initialLink.description ?? "");
      setType(initialLink.type);
      setDestinationUrl(initialLink.destinationUrl ?? "");
      setRedirectStatus(initialLink.redirectStatus === 301 ? 301 : 307);
      setForwardQueryParams(initialLink.forwardQueryParams);
      setHubLinks(
        initialLink.hubLinks && initialLink.hubLinks.length > 0
          ? initialLink.hubLinks
          : DEFAULT_HUB_ITEMS
      );
      setCategory(initialLink.category);
      setTagsText(initialLink.tags.join(", "));
      setIcon(initialLink.icon);
      setIsActive(initialLink.isActive);
      setIsPublic(initialLink.isPublic);
      setIsPinned(initialLink.isPinned);
      setExpiresAtInput(
        initialLink.expiresAt ? initialLink.expiresAt.slice(0, 16) : ""
      );
      setMaxClicksInput(
        initialLink.maxClicks !== null ? String(initialLink.maxClicks) : ""
      );
      setOgImageUrl(initialLink.ogImageUrl ?? "");
    } else {
      setSlugInput("");
      setTitle("");
      setDescription("");
      setType("DIRECT");
      setDestinationUrl("");
      setRedirectStatus(307);
      setForwardQueryParams(true);
      setHubLinks(DEFAULT_HUB_ITEMS);
      setCategory("project");
      setTagsText("");
      setIcon("link");
      setIsActive(true);
      setIsPublic(false);
      setIsPinned(false);
      setExpiresAtInput("");
      setMaxClicksInput("");
      setOgImageUrl("");
    }
  }, [open, initialLink]);

  const debouncedSlug = useDebouncedValue(slugInput, 250);

  useEffect(() => {
    if (!open) return;
    const raw = slugInput.trim();
    if (!raw) {
      setSlugStatus({ state: "idle" });
      return;
    }

    const localCheck = classifySlug(raw);
    if (!localCheck.ok) {
      setSlugStatus({
        state: "blocked",
        normalized: localCheck.normalized,
        message: localCheck.message,
      });
      return;
    }

    if (initialLink && localCheck.normalized === initialLink.slug) {
      setSlugStatus({
        state: "available",
        normalized: localCheck.normalized,
      });
      return;
    }

    if (normalizeSlug(debouncedSlug) !== localCheck.normalized) {
      setSlugStatus({ state: "checking", normalized: localCheck.normalized });
      return;
    }

    const controller = new AbortController();
    setSlugStatus({ state: "checking", normalized: localCheck.normalized });

    const params = new URLSearchParams({ slug: localCheck.normalized });
    if (initialLink) params.set("excludeId", initialLink.id);

    fetch(`/api/v1/links/check-slug?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as SlugAvailability;
        if (data.available) {
          setSlugStatus({
            state: "available",
            normalized: data.normalizedSlug,
          });
        } else {
          setSlugStatus({
            state: "blocked",
            normalized: data.normalizedSlug,
            message: data.message || "This slug is not available",
          });
        }
      })
      .catch(() => {
        // Ignore aborted requests
      });

    return () => controller.abort();
  }, [open, slugInput, debouncedSlug, initialLink]);

  const handleGenerateRandomSlug = async () => {
    try {
      const res = await fetch("/api/v1/links/check-slug?action=generate");
      if (!res.ok) return;
      const data = (await res.json()) as SlugAvailability;
      if (data.normalizedSlug) {
        setSlugInput(data.normalizedSlug);
        setSlugStatus({ state: "available", normalized: data.normalizedSlug });
      }
    } catch {
      // ignore
    }
  };

  const handleAddHubItem = () => {
    if (hubLinks.length >= 12) return;
    setHubLinks((prev) => [
      ...prev,
      {
        id: `item-${Date.now().toString(36)}`,
        label: "",
        url: "",
        icon: "external-link",
        variant: "secondary",
      },
    ]);
  };

  const handleUpdateHubItem = (
    index: number,
    patch: Partial<HubLinkItem>
  ) => {
    setHubLinks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveHubItem = (index: number) => {
    if (hubLinks.length <= 1) return;
    setHubLinks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slugStatus.state === "blocked") return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10);

      const payload: Record<string, unknown> = {
        slug: slugInput.trim() ? normalizeSlug(slugInput) : undefined,
        title: title.trim(),
        description: description.trim() || null,
        type,
        destinationUrl: type === "DIRECT" ? destinationUrl.trim() : null,
        redirectStatus,
        forwardQueryParams,
        hubLinks: type === "HUB" ? hubLinks : null,
        category,
        tags,
        icon,
        isActive,
        isPublic,
        isPinned,
        ogImageUrl: ogImageUrl.trim() || null,
        expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : null,
        maxClicks: maxClicksInput.trim() ? Number(maxClicksInput) : null,
      };

      if (pinInput.trim()) {
        payload.pin = pinInput.trim();
      } else if (clearExistingPin) {
        payload.pin = null;
      }

      const endpoint = initialLink
        ? `/api/v1/links/${initialLink.id}`
        : "/api/v1/links";
      const method = initialLink ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        setSubmitError(
          body?.error?.message || "Could not save the link. Please check the fields."
        );
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSaved(body as LinkDTO, isEdit);
      onClose();
    } catch {
      setSubmitError("Network error while saving the link.");
      setIsSubmitting(false);
    }
  };

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit /${initialLink?.slug}` : "Create New Short Link"}
      description="Configure a direct redirect or a project HUB micro-landing with anti-collision protection for cristianarando.dev."
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{submitError}</span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300">
              Custom Slug{" "}
              <span className="text-zinc-500">
                (leave empty to autogenerate 6 chars)
              </span>
            </label>
            <button
              type="button"
              onClick={handleGenerateRandomSlug}
              className="inline-flex cursor-pointer items-center gap-1 text-xs text-zinc-400 hover:text-white"
            >
              <Sparkles className="h-3 w-3" />
              Autogenerate (6 chars)
            </button>
          </div>
          <div className="mt-1.5 flex items-center rounded-xl border border-zinc-800 bg-zinc-900/80 px-3">
            <span className="select-none font-mono text-xs text-zinc-500">
              cristianarando.dev/
            </span>
            <input
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="smart-travel-guide"
              className="w-full bg-transparent py-2 pl-1 font-mono text-sm text-white placeholder:text-zinc-600 focus:outline-none"
            />
          </div>

          {slugStatus.state === "checking" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking availability for{" "}
              <code className="text-zinc-200">/{slugStatus.normalized}</code>...
            </p>
          )}
          {slugStatus.state === "available" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Available:{" "}
              <code className="font-mono">
                cristianarando.dev/{slugStatus.normalized}
              </code>
            </p>
          )}
          {slugStatus.state === "blocked" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{slugStatus.message}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-300">
              Link Title *
            </label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Smart Travel Guide App"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as LinkCategory)}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              <option value="project">Projects</option>
              <option value="social">Social</option>
              <option value="resource">Resources / Docs</option>
              <option value="personal">Personal</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-300">
            Resolution Mode
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("DIRECT")}
              className={`cursor-pointer rounded-xl border p-3 text-left transition ${
                type === "DIRECT"
                  ? "border-white bg-zinc-900 text-white"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <div className="text-xs font-semibold">Direct Redirect (307/301)</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">
                Redirects in &lt;50ms straight to the destination URL.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setType("HUB")}
              className={`cursor-pointer rounded-xl border p-3 text-left transition ${
                type === "HUB"
                  ? "border-white bg-zinc-900 text-white"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <div className="text-xs font-semibold">Project Micro-Landing (HUB)</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">
                Displays a project card with multiple action buttons (GitHub, Demo, Docs).
              </div>
            </button>
          </div>
        </div>

        {type === "DIRECT" ? (
          <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            <div>
              <label className="text-xs font-medium text-zinc-300">
                Destination URL *
              </label>
              <Input
                required
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://github.com/cristianarando/..."
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400">HTTP Status:</label>
                <select
                  value={redirectStatus}
                  onChange={(e) =>
                    setRedirectStatus(Number(e.target.value) as 307 | 301)
                  }
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200"
                >
                  <option value={307}>307 Temporary (Recommended)</option>
                  <option value={301}>301 Permanent (High cache)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <Switch
                  checked={forwardQueryParams}
                  onCheckedChange={setForwardQueryParams}
                  ariaLabel="Forward Query Params"
                />
                Forward query params (<code>?ref=cv</code>)
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                Project Buttons ({hubLinks.length}/12)
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddHubItem}
                disabled={hubLinks.length >= 12}
              >
                <Plus className="h-3.5 w-3.5" />
                Add button
              </Button>
            </div>
            <div className="space-y-2">
              {hubLinks.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5 sm:grid-cols-12"
                >
                  <Input
                    required
                    value={item.label}
                    onChange={(e) =>
                      handleUpdateHubItem(idx, { label: e.target.value })
                    }
                    placeholder="Label (e.g. View GitHub)"
                    className="text-xs sm:col-span-4"
                  />
                  <Input
                    required
                    type="url"
                    value={item.url}
                    onChange={(e) =>
                      handleUpdateHubItem(idx, { url: e.target.value })
                    }
                    placeholder="https://..."
                    className="font-mono text-xs sm:col-span-6"
                  />
                  <div className="flex items-center justify-end gap-1 sm:col-span-2">
                    <select
                      value={item.variant}
                      onChange={(e) =>
                        handleUpdateHubItem(idx, {
                          variant: e.target.value as HubLinkItem["variant"],
                        })
                      }
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-1.5 py-1.5 text-[11px] text-zinc-300"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="outline">Outline</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveHubItem(idx)}
                      disabled={hubLinks.length <= 1}
                      aria-label="Remove button"
                      className="cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-red-950/50 hover:text-red-300 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Description (Open Graph / Directory)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of the project or destination"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Tags (comma-separated)
            </label>
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="nextjs, turso, opensource"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-300">
            Icon
          </label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 sm:grid-cols-3">
          <label className="flex items-center justify-between gap-2 text-xs text-zinc-300">
            <span>Active Link</span>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              ariaLabel="Active link"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-zinc-300">
            <span>Public on /links</span>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              ariaLabel="Visible on public directory"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-zinc-300">
            <span>Pin to top</span>
            <Switch
              checked={isPinned}
              onCheckedChange={setIsPinned}
              ariaLabel="Pin link to top"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Access PIN {initialLink?.hasPin ? "(Configured)" : "(Optional)"}
            </label>
            <Input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder={initialLink?.hasPin ? "New PIN..." : "Min. 4 chars"}
              className="mt-1 text-xs"
            />
            {initialLink?.hasPin && (
              <label className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
                <input
                  type="checkbox"
                  checked={clearExistingPin}
                  onChange={(e) => setClearExistingPin(e.target.checked)}
                />
                Remove current PIN
              </label>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Expiration Date (Optional)
            </label>
            <Input
              type="datetime-local"
              value={expiresAtInput}
              onChange={(e) => setExpiresAtInput(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Max Clicks (Optional)
            </label>
            <Input
              type="number"
              min={1}
              value={maxClicksInput}
              onChange={(e) => setMaxClicksInput(e.target.value)}
              placeholder="Unlimited"
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || slugStatus.state === "blocked"}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Link"
            )}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
