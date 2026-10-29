"use client";

import React, { useEffect, useState } from "react";
import { Download, QrCode } from "lucide-react";
import {
  buildCanonicalQrTargetUrl,
  generateQrCodePngDataUrl,
  generateQrCodeSvg,
} from "@/lib/qr-generator";
import type { LinkDTO } from "@/lib/types/link-dto";
import { Button, DialogModal, Switch } from "@/components/ui/primitives";

export interface QrCodeModalProps {
  open: boolean;
  link: LinkDTO | null;
  onClose: () => void;
}

const COLOR_PRESETS = [
  { label: "Classic Dark", dark: "#09090b", light: "#ffffff" },
  { label: "Emerald Pro", dark: "#064e3b", light: "#ecfdf5" },
  { label: "Midnight Indigo", dark: "#1e1b4b", light: "#eef2ff" },
];

function svgToPngDataUrl(svgString: string, size = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return resolve("");
    }
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error("Canvas context 2D not available"));
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export function QrCodeModal({ open, link, onClose }: QrCodeModalProps) {
  const [darkColor, setDarkColor] = useState("#09090b");
  const [lightColor, setLightColor] = useState("#ffffff");
  const [includeBadge, setIncludeBadge] = useState(true);
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [pngDataUrl, setPngDataUrl] = useState<string>("");

  useEffect(() => {
    if (!open || !link) return;
    let active = true;

    generateQrCodeSvg({
      slug: link.slug,
      darkColor,
      lightColor,
      includeCenterBadge: includeBadge,
      sizePx: 1024,
    })
      .then(async (svg) => {
        if (!active) return;
        setSvgMarkup(svg);
        try {
          const png = await svgToPngDataUrl(svg, 1024);
          if (active) setPngDataUrl(png);
        } catch {
          const fallbackPng = await generateQrCodePngDataUrl({
            slug: link.slug,
            darkColor,
            lightColor,
            sizePx: 1024,
          });
          if (active) setPngDataUrl(fallbackPng);
        }
      })
      .catch((err) => {
        console.error("Failed to generate QR code:", err);
      });

    return () => {
      active = false;
    };
  }, [open, link, darkColor, lightColor, includeBadge]);

  if (!link) return null;

  const canonicalUrl = buildCanonicalQrTargetUrl(link.slug);

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${link.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = `qr-${link.slug}-1024px.png`;
    a.click();
  };

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={`QR Code — /${link.slug}`}
      description={`Always points to the canonical domain ${canonicalUrl} with Level H (30%) error correction.`}
      maxWidthClass="max-w-md"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-64 w-64 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-white p-3 shadow-inner">
          {svgMarkup ? (
            <div
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          ) : (
            <QrCode className="h-10 w-10 animate-pulse text-zinc-400" />
          )}
        </div>

        <div className="w-full space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setDarkColor(preset.dark);
                  setLightColor(preset.light);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  darkColor === preset.dark
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-300">
              Embed center <code className="font-mono text-emerald-400">&lt;/&gt; CA</code> badge
            </span>
            <Switch
              checked={includeBadge}
              onCheckedChange={setIncludeBadge}
              ariaLabel="Embed dev badge in QR code"
            />
          </div>
        </div>

        <div className="flex w-full gap-2.5">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleDownloadSvg}
          >
            <Download className="h-4 w-4" />
            Download SVG
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={handleDownloadPng}
          >
            <Download className="h-4 w-4" />
            Download PNG (1024px)
          </Button>
        </div>
      </div>
    </DialogModal>
  );
}
