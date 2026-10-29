"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { HubLinkItem } from "@/lib/validations/link.schema";
import { ICON_OPTIONS } from "@/components/ui/icons";
import { Button, Input } from "@/components/ui/primitives";

export interface HubLinksEditorProps {
  items: HubLinkItem[];
  onChange: (next: HubLinkItem[]) => void;
}

export function HubLinksEditor({ items, onChange }: HubLinksEditorProps) {
  const handleAdd = () => {
    onChange([
      ...items,
      {
        id: `hub-${items.length + 1}-${Date.now().toString(36)}`,
        label: "",
        url: "",
        icon: "globe",
        variant: "secondary",
      },
    ]);
  };

  const handleUpdate = (index: number, patch: Partial<HubLinkItem>) => {
    onChange(items.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const handleRemove = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">
          Micro-Landing Buttons (minimum 1)
        </span>
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add button
        </Button>
      </div>

      {items.map((item, idx) => (
        <div
          key={item.id}
          className="grid gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 sm:grid-cols-12"
        >
          <div className="sm:col-span-4">
            <Input
              placeholder="Label (e.g. Live Demo)"
              value={item.label}
              onChange={(e) => handleUpdate(idx, { label: e.target.value })}
            />
          </div>
          <div className="sm:col-span-5">
            <Input
              type="url"
              placeholder="https://..."
              value={item.url}
              onChange={(e) => handleUpdate(idx, { url: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1.5 sm:col-span-3">
            <select
              value={item.icon}
              onChange={(e) => handleUpdate(idx, { icon: e.target.value })}
              aria-label="Sub-link icon"
              className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200"
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              disabled={items.length <= 1}
              aria-label="Remove button"
              className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
