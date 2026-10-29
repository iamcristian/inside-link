import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "(.*\\.vercel\\.app)",
          },
        ],
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
