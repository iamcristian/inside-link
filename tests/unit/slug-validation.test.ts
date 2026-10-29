import { describe, it, expect } from "vitest";
import { normalizeSlug, SlugSchema, classifySlug } from "@/lib/validations/slug.schema";
import { CreateLinkSchema, SafeUrlSchema } from "@/lib/validations/link.schema";
import { isReservedSlug } from "@/lib/constants/reserved-slugs";

describe("Slug Normalization & Anti-Collision Engine", () => {
  it("normalizes spaces to hyphens and strips diacritics", () => {
    expect(normalizeSlug("  Mi Guía Turística 2026  ")).toBe("mi-guia-turistica-2026");
    expect(normalizeSlug("Proyecto---Especial")).toBe("proyecto-especial");
    expect(normalizeSlug("--inicio--")).toBe("inicio");
  });

  it("identifies reserved language routes", () => {
    expect(isReservedSlug("es")).toBe(true);
    expect(isReservedSlug("en")).toBe(true);
    expect(isReservedSlug("de")).toBe(true);
    expect(isReservedSlug("ru")).toBe(true);
    expect(isReservedSlug("ja")).toBe(true);
    expect(isReservedSlug("fr")).toBe(true);
    expect(isReservedSlug("pt")).toBe(true);
  });

  it("identifies reserved portfolio routes", () => {
    expect(isReservedSlug("uses")).toBe(true);
    expect(isReservedSlug("cv")).toBe(true);
    expect(isReservedSlug("resume")).toBe(true);
    expect(isReservedSlug("projects")).toBe(true);
    expect(isReservedSlug("blog")).toBe(true);
    expect(isReservedSlug("about")).toBe(true);
    expect(isReservedSlug("contact")).toBe(true);
  });

  it("identifies reserved system routes", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("dashboard")).toBe(true);
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("links")).toBe(true);
    expect(isReservedSlug("auth")).toBe(true);
  });

  it("blocks dangerous file extensions", () => {
    expect(isReservedSlug("favicon.ico")).toBe(true);
    expect(isReservedSlug("robots.txt")).toBe(true);
    expect(isReservedSlug("sitemap.xml")).toBe(true);
    expect(isReservedSlug("bundle.js")).toBe(true);
    expect(isReservedSlug("style.css")).toBe(true);
  });

  it("rejects reserved slugs via SlugSchema", () => {
    expect(SlugSchema.safeParse("admin").success).toBe(false);
    expect(SlugSchema.safeParse("uses").success).toBe(false);
    expect(SlugSchema.safeParse("projects").success).toBe(false);
    expect(SlugSchema.safeParse("es").success).toBe(false);
    expect(SlugSchema.safeParse("cv").success).toBe(false);
  });

  it("rejects file-like slugs before normalization strips the dot", () => {
    expect(SlugSchema.safeParse("favicon.ico").success).toBe(false);
    expect(SlugSchema.safeParse("file.json").success).toBe(false);
    expect(SlugSchema.safeParse("my.page").success).toBe(false);
  });

  it("classifySlug distinguishes reserved from invalid slugs", () => {
    expect(classifySlug("admin")).toMatchObject({ ok: false, reason: "RESERVED" });
    expect(classifySlug("favicon.ico")).toMatchObject({ ok: false, reason: "RESERVED" });
    expect(classifySlug("my.page")).toMatchObject({ ok: false, reason: "INVALID" });
    expect(classifySlug("x1")).toMatchObject({ ok: false, reason: "INVALID" });
    expect(classifySlug("  Mi Proyecto  ")).toEqual({ ok: true, normalized: "mi-proyecto" });
  });

  it("rejects slugs that are too short (< 3 characters)", () => {
    expect(SlugSchema.safeParse("a").success).toBe(false);
    expect(SlugSchema.safeParse("ab").success).toBe(false);
  });

  it("accepts valid custom slugs", () => {
    const r1 = SlugSchema.safeParse("mi-guia-turistica");
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data).toBe("mi-guia-turistica");

    const r2 = SlugSchema.safeParse("portfolio-v2");
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data).toBe("portfolio-v2");

    const r3 = SlugSchema.safeParse("github");
    expect(r3.success).toBe(true);
    if (r3.success) expect(r3.data).toBe("github");
  });
});

describe("Link Schema & Security Validation", () => {
  it("rejects malicious XSS protocols in destination URLs", () => {
    expect(SafeUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(SafeUrlSchema.safeParse("data:text/html,<script>alert(1)</script>").success).toBe(false);
    expect(SafeUrlSchema.safeParse("vbscript:msgbox(1)").success).toBe(false);
    expect(SafeUrlSchema.safeParse("file:///etc/passwd").success).toBe(false);
  });

  it("accepts valid HTTPS and HTTP URLs", () => {
    expect(SafeUrlSchema.safeParse("https://github.com/cristianarando").success).toBe(true);
    expect(SafeUrlSchema.safeParse("http://localhost:3000/demo").success).toBe(true);
  });

  it("enforces DIRECT link invariants: requires destinationUrl", () => {
    const invalidDirect = CreateLinkSchema.safeParse({
      title: "Direct without URL",
      type: "DIRECT",
      slug: "direct-invalid",
    });
    expect(invalidDirect.success).toBe(false);

    const validDirect = CreateLinkSchema.safeParse({
      title: "Direct Valid",
      type: "DIRECT",
      slug: "direct-valid",
      destinationUrl: "https://example.com",
    });
    expect(validDirect.success).toBe(true);
  });

  it("enforces HUB link invariants: requires at least 1 sub-link", () => {
    const invalidHub = CreateLinkSchema.safeParse({
      title: "Hub without links",
      type: "HUB",
      slug: "hub-invalid",
      hubLinks: [],
    });
    expect(invalidHub.success).toBe(false);

    const validHub = CreateLinkSchema.safeParse({
      title: "Hub Valid",
      type: "HUB",
      slug: "hub-valid",
      hubLinks: [
        {
          id: "repo",
          label: "GitHub Repo",
          url: "https://github.com/cristianarando/inside-link",
          icon: "github",
          variant: "primary",
        },
      ],
    });
    expect(validHub.success).toBe(true);
  });
});
