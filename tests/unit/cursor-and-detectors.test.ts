import { describe, it, expect } from "vitest";
import { encodeLinkCursor, decodeLinkCursor } from "@/lib/cursor";
import { isSocialPreviewBot, isPrefetchRequest } from "@/lib/bot-detector";
import { extractTrafficMetadata } from "@/lib/geo-headers";
import { ulid } from "ulidx";

describe("Composite Cursor Codec", () => {
  it("encodes and decodes cursors cleanly (round-trip)", () => {
    const testUlid = ulid();
    const encoded = encodeLinkCursor({ p: 1, id: testUlid });
    expect(typeof encoded).toBe("string");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");

    const decoded = decodeLinkCursor(encoded);
    expect(decoded).toEqual({ p: 1, id: testUlid });

    const encodedUnpinned = encodeLinkCursor({ p: 0, id: testUlid });
    const decodedUnpinned = decodeLinkCursor(encodedUnpinned);
    expect(decodedUnpinned).toEqual({ p: 0, id: testUlid });
  });

  it("handles corrupted or invalid cursors safely returning null", () => {
    expect(decodeLinkCursor(null)).toBeNull();
    expect(decodeLinkCursor(undefined)).toBeNull();
    expect(decodeLinkCursor("")).toBeNull();
    expect(decodeLinkCursor("not-base64-json")).toBeNull();
    expect(decodeLinkCursor(Buffer.from(JSON.stringify({ p: 2, id: "bad" })).toString("base64"))).toBeNull();
    expect(decodeLinkCursor(Buffer.from(JSON.stringify({ p: 1, id: "short" })).toString("base64"))).toBeNull();
  });
});

describe("Bot & Prefetch Detector", () => {
  it("detects social preview crawlers and bots", () => {
    expect(isSocialPreviewBot("WhatsApp/2.24.1.78 A")).toBe(true);
    expect(isSocialPreviewBot("Mozilla/5.0 (compatible; LinkedInBot/1.0; +http://www.linkedin.com)")).toBe(true);
    expect(isSocialPreviewBot("Twitterbot/1.0")).toBe(true);
    expect(isSocialPreviewBot("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)")).toBe(true);
    expect(isSocialPreviewBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
  });

  it("does not flag regular human browsers as social preview bots", () => {
    expect(
      isSocialPreviewBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
    ).toBe(false);
    expect(
      isSocialPreviewBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
    ).toBe(false);
  });

  it("detects browser prefetch requests", () => {
    expect(isPrefetchRequest({ purpose: "prefetch" })).toBe(true);
    expect(isPrefetchRequest({ "sec-purpose": "prefetch" })).toBe(true);
    expect(isPrefetchRequest({ "next-router-prefetch": "1" })).toBe(true);
    expect(isPrefetchRequest({ "x-purpose": "preview" })).toBe(true);
    expect(isPrefetchRequest({ "user-agent": "regular" })).toBe(false);
  });
});

describe("Traffic Metadata Extractor", () => {
  it("extracts country, device, OS, browser and referrer correctly", () => {
    const headers = {
      "x-vercel-ip-country": "bo",
      "x-vercel-ip-city": "Cochabamba",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      referer: "https://www.linkedin.com/feed/",
    };
    const searchParams = new URLSearchParams("ref=portfolio_cv&source=web");

    const meta = extractTrafficMetadata(headers, searchParams);
    expect(meta.country).toBe("BO");
    expect(meta.city).toBe("Cochabamba");
    expect(meta.device).toBe("mobile");
    expect(meta.os).toBe("iOS");
    expect(meta.browser).toBe("Safari");
    expect(meta.referrer).toBe("linkedin.com");
    expect(meta.queryParamRef).toBe("portfolio_cv");
  });

  it("falls back to defaults when headers are missing", () => {
    const meta = extractTrafficMetadata({});
    expect(meta.country).toBe("XX");
    expect(meta.city).toBeNull();
    expect(meta.device).toBe("desktop");
    expect(meta.os).toBe("Other");
    expect(meta.browser).toBe("Other");
    expect(meta.referrer).toBe("Direct");
    expect(meta.queryParamRef).toBeNull();
  });
});
