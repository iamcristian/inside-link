import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsideLink — cristianarando.dev",
  description: "URL Shortener, Project Micro-Landings & Public Link Directory",
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
