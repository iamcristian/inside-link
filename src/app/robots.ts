import type { MetadataRoute } from "next";
import { getCanonicalBaseUrl } from "@/server/og/presentation";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getCanonicalBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/login", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
