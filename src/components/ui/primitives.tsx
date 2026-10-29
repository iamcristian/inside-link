"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-white text-zinc-950 hover:bg-zinc-200 shadow-sm",
    secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/80",
    outline: "border border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800 hover:text-white",
    ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70",
    danger: "bg-red-950/70 text-red-200 border border-red-900/70 hover:bg-red-900/60",
  };

  const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "px-2.5 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-3.5 py-2 text-sm rounded-xl gap-2",
    lg: "px-5 py-2.5 text-sm rounded-xl gap-2.5",
    icon: "h-8 w-8 rounded-lg justify-center",
  };

  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700/50 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "success" | "warning" | "danger" | "purple" | "blue";
  className?: string;
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    default: "border-zinc-800 bg-zinc-900 text-zinc-300",
    success: "border-emerald-900/60 bg-emerald-950/50 text-emerald-300",
    warning: "border-amber-900/60 bg-amber-950/50 text-amber-300",
    danger: "border-red-900/60 bg-red-950/50 text-red-300",
    purple: "border-purple-900/60 bg-purple-950/50 text-purple-300",
    blue: "border-sky-900/60 bg-sky-950/50 text-sky-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-50",
        checked
          ? "border-emerald-500/40 bg-emerald-500"
          : "border-zinc-700 bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-zinc-800/60 border border-zinc-800/40",
        className
      )}
    />
  );
}

export function DialogModal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl",
          maxWidthClass
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-zinc-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
