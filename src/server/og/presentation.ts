import { createHash } from "node:crypto";
import type { LinkDTO } from "@/lib/types/link-dto";

type OgLink = Pick<
  LinkDTO,
  "title" | "description" | "slug" | "category" | "type" | "hasPin" | "ogMode"
>;

function clip(value: string, limit: number): string {
  const parts = Array.from(
    new Intl.Segmenter().segment(value.trim().replace(/\s+/g, " ")),
  );
  const text = parts
    .slice(0, limit)
    .map(({ segment }) => segment)
    .join("");
  return parts.length > limit ? `${text.trimEnd()}…` : text;
}

export function buildProtectedOgPresentation() {
  return {
    title: "Protected link",
    description: "This link requires a PIN to open.",
    label: "INSIDELINK",
    slug: "",
  };
}

export function buildOgPresentation(link?: OgLink) {
  if (link?.hasPin) return buildProtectedOgPresentation();
  if (!link || link.ogMode === "minimal") {
    return {
      title: "InsideLink",
      description: "Official links and project resources.",
      label: "INSIDELINK",
      slug: "",
    };
  }

  return {
    title: clip(link.title, 76),
    description: clip(
      link.description || "Official link on cristianarando.dev.",
      128,
    ),
    label: link.type === "HUB" ? "PROJECT HUB" : link.category.toUpperCase(),
    slug: clip(`/${link.slug}`, 48),
  };
}

export type OgPresentation = ReturnType<typeof buildOgPresentation>;

export function ogRevision(presentation: OgPresentation): string {
  return createHash("sha256")
    .update(JSON.stringify(["inside-link-card-v5", presentation]))
    .digest("hex")
    .slice(0, 32);
}

export function getCanonicalBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CANONICAL_URL || "https://cristianarando.dev"
  ).replace(/\/+$/, "");
}

export function resolveOgImage(
  link: LinkDTO,
  presentation = buildOgPresentation(link),
) {
  const custom =
    !link.hasPin &&
    link.ogMode === "custom" &&
    /^https:\/\//i.test(link.ogImageUrl ?? "");
  if (custom && link.ogImageUrl)
    return { url: link.ogImageUrl, generated: false };

  const path = link.hasPin
    ? "protected"
    : link.ogMode === "minimal"
      ? "default"
      : `${link.id}/${ogRevision(presentation)}`;
  return {
    url: `${getCanonicalBaseUrl()}/api/v1/og/${path}/image.png`,
    generated: true,
  };
}
