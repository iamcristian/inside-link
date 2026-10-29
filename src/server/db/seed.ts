import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { ulid } from "ulidx";
import * as schema from "./schema";
import { hashPin } from "../crypto/pin";

async function runSeed() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error("ERROR: Refusing to seed database in production without --force flag.");
    process.exit(1);
  }

  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  console.log(`Connecting to database at ${url}...`);
  const client = createClient({ url, authToken });
  await client.execute("PRAGMA foreign_keys = ON;");
  const db = drizzle(client, { schema });

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  console.log("Cleaning existing demo data...");
  await client.execute("DELETE FROM pin_attempts;");
  await client.execute("DELETE FROM click_events;");
  await client.execute("DELETE FROM links;");

  console.log("Inserting 18 realistic links...");

  const seedLinks = [
    {
      id: ulid(),
      slug: "github",
      type: "DIRECT" as const,
      destinationUrl: "https://github.com/cristianarando",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "GitHub Profile",
      description: "Open-source repositories, software architecture, and code contributions.",
      category: "social" as const,
      tagsJson: JSON.stringify(["github", "code", "opensource"]),
      icon: "github",
      isActive: true,
      isPublic: true,
      isPinned: true,
      clicksCount: 42,
      createdAt: new Date(now - 30 * dayMs),
      updatedAt: new Date(now - 10 * dayMs),
    },
    {
      id: ulid(),
      slug: "linkedin",
      type: "DIRECT" as const,
      destinationUrl: "https://linkedin.com/in/cristianarando",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "LinkedIn Profile",
      description: "Professional background, engineering experience, and network.",
      category: "social" as const,
      tagsJson: JSON.stringify(["linkedin", "career", "network"]),
      icon: "linkedin",
      isActive: true,
      isPublic: true,
      isPinned: true,
      clicksCount: 38,
      createdAt: new Date(now - 28 * dayMs),
      updatedAt: new Date(now - 8 * dayMs),
    },
    {
      id: ulid(),
      slug: "proyecto-guia-turistica",
      type: "HUB" as const,
      destinationUrl: null,
      redirectStatus: 307,
      forwardQueryParams: true,
      hubLinksJson: JSON.stringify([
        {
          id: "repo",
          label: "View GitHub Repository",
          url: "https://github.com/cristianarando/guia-turistica",
          icon: "github",
          variant: "primary",
        },
        {
          id: "demo",
          label: "Try Live Demo",
          url: "https://guia-turistica.cristianarando.dev",
          icon: "external-link",
          variant: "secondary",
        },
        {
          id: "docs",
          label: "Architecture & Documentation",
          url: "https://github.com/cristianarando/guia-turistica/tree/main/docs",
          icon: "book-open",
          variant: "outline",
        },
      ]),
      title: "Smart Travel Guide App",
      description: "Mobile and web platform for travel discovery with offline recommendations.",
      category: "project" as const,
      tagsJson: JSON.stringify(["travel", "react-native", "nextjs", "offline"]),
      icon: "map-pin",
      isActive: true,
      isPublic: true,
      isPinned: true,
      clicksCount: 25,
      createdAt: new Date(now - 25 * dayMs),
      updatedAt: new Date(now - 5 * dayMs),
    },
    {
      id: ulid(),
      slug: "mi-cv",
      type: "DIRECT" as const,
      destinationUrl: "https://cristianarando.dev/cv",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "Curriculum Vitae (Resume)",
      description: "Up-to-date downloadable PDF resume and engineering experience.",
      category: "resource" as const,
      tagsJson: JSON.stringify(["cv", "resume", "pdf"]),
      icon: "file-text",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 19,
      createdAt: new Date(now - 20 * dayMs),
      updatedAt: new Date(now - 2 * dayMs),
    },
    {
      id: ulid(),
      slug: "inside-link",
      type: "HUB" as const,
      destinationUrl: null,
      redirectStatus: 307,
      forwardQueryParams: true,
      hubLinksJson: JSON.stringify([
        {
          id: "repo",
          label: "GitHub Repository",
          url: "https://github.com/cristianarando/inside-link",
          icon: "github",
          variant: "primary",
        },
        {
          id: "docs",
          label: "System Design & Backlog",
          url: "https://cristianarando.dev/docs/inside-link",
          icon: "book-open",
          variant: "secondary",
        },
      ]),
      title: "InsideLink Platform",
      description: "Custom URL shortener, project micro-landings, and link hub built with Turso & Next.js.",
      category: "project" as const,
      tagsJson: JSON.stringify(["nextjs", "turso", "drizzle", "system-design"]),
      icon: "link",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 15,
      createdAt: new Date(now - 15 * dayMs),
      updatedAt: new Date(now - 1 * dayMs),
    },
    {
      id: ulid(),
      slug: "presupuesto-confidencial",
      type: "DIRECT" as const,
      destinationUrl: "https://drive.google.com/file/d/demo-presupuesto-hash/view",
      redirectStatus: 307,
      forwardQueryParams: false,
      title: "Project Proposal & Quote (Protected)",
      description: "Confidential commercial proposal with detailed breakdown (Demo PIN: 1234).",
      category: "personal" as const,
      tagsJson: JSON.stringify(["commercial", "private"]),
      icon: "lock",
      isActive: true,
      isPublic: false,
      isPinned: false,
      passwordHash: hashPin("1234"),
      clicksCount: 4,
      createdAt: new Date(now - 7 * dayMs),
      updatedAt: new Date(now - 1 * dayMs),
    },
    {
      id: ulid(),
      slug: "enlace-expirado",
      type: "DIRECT" as const,
      destinationUrl: "https://meet.google.com/xyz-demo",
      redirectStatus: 307,
      forwardQueryParams: false,
      title: "Sync Meeting Link (Expired)",
      description: "Temporary link for an engineering coordination call.",
      category: "temporary" as const,
      tagsJson: JSON.stringify(["meet", "temporary"]),
      icon: "clock",
      isActive: true,
      isPublic: false,
      isPinned: false,
      expiresAt: new Date(now - 2 * dayMs),
      clicksCount: 3,
      createdAt: new Date(now - 5 * dayMs),
      updatedAt: new Date(now - 2 * dayMs),
    },
    {
      id: ulid(),
      slug: "tiendanext",
      type: "HUB" as const,
      destinationUrl: null,
      redirectStatus: 307,
      forwardQueryParams: true,
      hubLinksJson: JSON.stringify([
        {
          id: "repo",
          label: "Source Code on GitHub",
          url: "https://github.com/cristianarando/tiendanext",
          icon: "github",
          variant: "primary",
        },
      ]),
      title: "TiendaNext E-Commerce",
      description: "Conversational commerce platform powered by WhatsApp and NestJS.",
      category: "project" as const,
      tagsJson: JSON.stringify(["ecommerce", "whatsapp", "nestjs"]),
      icon: "shopping-bag",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 12,
      createdAt: new Date(now - 14 * dayMs),
      updatedAt: new Date(now - 4 * dayMs),
    },
    {
      id: ulid(),
      slug: "whatsapp",
      type: "DIRECT" as const,
      destinationUrl: "https://wa.me/59170000000",
      redirectStatus: 307,
      forwardQueryParams: false,
      title: "Direct WhatsApp Chat",
      description: "Direct messaging channel for quick inquiries and collaboration.",
      category: "social" as const,
      tagsJson: JSON.stringify(["whatsapp", "contact"]),
      icon: "message-circle",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 11,
      createdAt: new Date(now - 12 * dayMs),
      updatedAt: new Date(now - 2 * dayMs),
    },
    {
      id: ulid(),
      slug: "reunion-meet",
      type: "DIRECT" as const,
      destinationUrl: "https://meet.google.com/abc-demo",
      redirectStatus: 307,
      forwardQueryParams: false,
      title: "Video Call Room (Max 5 Clicks)",
      description: "Temporary meeting link with a maximum click cap.",
      category: "temporary" as const,
      tagsJson: JSON.stringify(["meet", "temporary"]),
      icon: "video",
      isActive: true,
      isPublic: false,
      isPinned: false,
      maxClicks: 5,
      clicksCount: 2,
      createdAt: new Date(now - 3 * dayMs),
      updatedAt: new Date(now - 1 * dayMs),
    },
    {
      id: ulid(),
      slug: "sistema-solar-3d",
      type: "DIRECT" as const,
      destinationUrl: "https://solarsystem.cristianarando.dev",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "3D Solar System in Three.js",
      description: "Interactive 3D solar system simulator built with WebGL and Three.js.",
      category: "project" as const,
      tagsJson: JSON.stringify(["threejs", "webgl", "canvas"]),
      icon: "globe",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 8,
      createdAt: new Date(now - 18 * dayMs),
      updatedAt: new Date(now - 5 * dayMs),
    },
    {
      id: ulid(),
      slug: "bolivia-tech",
      type: "DIRECT" as const,
      destinationUrl: "https://github.com/bolivia-tech/comunidad",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "Bolivia Tech Community",
      description: "Open directory of tech communities, events, and developer resources.",
      category: "resource" as const,
      tagsJson: JSON.stringify(["community", "bolivia", "tech"]),
      icon: "users",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 9,
      createdAt: new Date(now - 16 * dayMs),
      updatedAt: new Date(now - 3 * dayMs),
    },
    {
      id: ulid(),
      slug: "podcast-ia",
      type: "DIRECT" as const,
      destinationUrl: "https://spotify.com/show/demo-podcast",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "AI Engineering Podcast Episodes",
      description: "Deep-dive discussions on autonomous agents, LLMs, and distributed systems.",
      category: "resource" as const,
      tagsJson: JSON.stringify(["podcast", "ai", "audio"]),
      icon: "headphones",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 6,
      createdAt: new Date(now - 11 * dayMs),
      updatedAt: new Date(now - 1 * dayMs),
    },
    {
      id: ulid(),
      slug: "notas-personales",
      type: "DIRECT" as const,
      destinationUrl: "https://notion.so/cristianarando/demo-notes",
      redirectStatus: 307,
      forwardQueryParams: false,
      title: "Private Engineering Notes",
      description: "Personal engineering logbook and architecture drafts.",
      category: "personal" as const,
      tagsJson: JSON.stringify(["notion", "notes"]),
      icon: "book",
      isActive: true,
      isPublic: false,
      isPinned: false,
      clicksCount: 2,
      createdAt: new Date(now - 9 * dayMs),
      updatedAt: new Date(now - 1 * dayMs),
    },
    {
      id: ulid(),
      slug: "design-system",
      type: "DIRECT" as const,
      destinationUrl: "https://www.figma.com/@cristianarando",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "Figma Design Tokens & UI Kit",
      description: "Reusable UI components and visual design system guidelines.",
      category: "resource" as const,
      tagsJson: JSON.stringify(["figma", "ui", "design"]),
      icon: "palette",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 7,
      createdAt: new Date(now - 8 * dayMs),
      updatedAt: new Date(now - 2 * dayMs),
    },
    {
      id: ulid(),
      slug: "twitter",
      type: "DIRECT" as const,
      destinationUrl: "https://x.com/cristianarando",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "X / Twitter",
      description: "Short thoughts on software engineering, web performance, and AI.",
      category: "social" as const,
      tagsJson: JSON.stringify(["twitter", "x"]),
      icon: "twitter",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 14,
      createdAt: new Date(now - 22 * dayMs),
      updatedAt: new Date(now - 6 * dayMs),
    },
    {
      id: ulid(),
      slug: "youtube",
      type: "DIRECT" as const,
      destinationUrl: "https://youtube.com/@cristianarando",
      redirectStatus: 307,
      forwardQueryParams: true,
      title: "YouTube Channel",
      description: "Programming tutorials, system design walkthroughs, and live coding.",
      category: "social" as const,
      tagsJson: JSON.stringify(["youtube", "video", "tutorials"]),
      icon: "youtube",
      isActive: true,
      isPublic: true,
      isPinned: false,
      clicksCount: 18,
      createdAt: new Date(now - 24 * dayMs),
      updatedAt: new Date(now - 4 * dayMs),
    },
    {
      id: ulid(),
      slug: "enlace-pausado",
      type: "DIRECT" as const,
      destinationUrl: "https://example.com/demo",
      redirectStatus: 307,
      forwardQueryParams: false,
      title: "Temporarily Paused Link",
      description: "Link currently under maintenance.",
      category: "temporary" as const,
      tagsJson: JSON.stringify(["demo"]),
      icon: "pause-circle",
      isActive: false,
      isPublic: false,
      isPinned: false,
      clicksCount: 1,
      createdAt: new Date(now - 6 * dayMs),
      updatedAt: new Date(now - 1 * dayMs),
    },
  ];

  await db.insert(schema.links).values(seedLinks);
  console.log(`Inserted ${seedLinks.length} links successfully.`);

  console.log("Generating 120 click events distributed across the last 30 days...");
  const countries = ["BO", "BO", "BO", "ES", "ES", "US", "AR", "MX", "PE", "CL"];
  const devices = ["desktop", "mobile", "mobile", "tablet"] as const;
  const osList = ["Windows", "macOS", "Android", "iOS", "Linux"] as const;
  const browsers = ["Chrome", "Safari", "Firefox", "Edge"] as const;
  const referrers = ["linkedin.com", "github.com", "t.co", "Direct", "Direct", "wa.me"];

  const seedEvents: schema.NewClickEvent[] = [];
  const publicLinks = seedLinks.filter((l) => l.clicksCount > 0);

  for (let i = 0; i < 120; i++) {
    const link = publicLinks[i % publicLinks.length]!;
    const offsetMs = Math.floor(Math.random() * 30 * dayMs);
    const eventTime = new Date(now - offsetMs);

    seedEvents.push({
      id: ulid(),
      linkId: link.id,
      country: countries[Math.floor(Math.random() * countries.length)] || "BO",
      city: "La Paz",
      device: devices[Math.floor(Math.random() * devices.length)] || "desktop",
      os: osList[Math.floor(Math.random() * osList.length)] || "Windows",
      browser: browsers[Math.floor(Math.random() * browsers.length)] || "Chrome",
      referrer: referrers[Math.floor(Math.random() * referrers.length)] || "Direct",
      queryParamRef: i % 4 === 0 ? "cv_profile" : null,
      clickedAt: eventTime,
    });
  }

  for (let i = 0; i < seedEvents.length; i += 50) {
    const chunk = seedEvents.slice(i, i + 50);
    await db.insert(schema.clickEvents).values(chunk);
  }

  console.log(`Inserted ${seedEvents.length} click events successfully.`);
  console.log("Database seed completed cleanly.");
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
