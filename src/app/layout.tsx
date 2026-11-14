import type { Metadata } from "next";
import { getCanonicalBaseUrl, getPortfolioBaseUrl } from "@/server/og/presentation";
import "./globals.css";

const canonicalUrl = getCanonicalBaseUrl();
const portfolioUrl = getPortfolioBaseUrl();

const SITE_TITLE = "Cristian Arando — Links & Projects";
const SITE_DESCRIPTION =
  "Curated directory of full-stack software projects, interactive micro-landings, open-source repositories, and verified profiles by Cristian Arando.";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrl),
  title: {
    default: SITE_TITLE,
    template: "%s | InsideLink",
  },
  description: SITE_DESCRIPTION,
  applicationName: "InsideLink",
  authors: [{ name: "Cristian Arando", url: portfolioUrl }],
  creator: "Cristian Arando",
  keywords: [
    "Cristian Arando",
    "Software Engineer",
    "Full-Stack",
    "Open Source",
    "Projects",
    "Links",
    "InsideLink",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "links.cristianarando.dev",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/api/v1/og/default/image.png",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/api/v1/og/default/image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
