# InsideLink (`cristianarando.dev`) — Architecture Suite & Engineering Specifications

> **System:** `inside-link` (Single-Owner Link Shortener, Project Showcase HUBs, and Public Directory for `cristianarando.dev`)  
> **Initial Architecture Date:** October 2026  
> **Status:** Fully Implemented and Verified (`24/24` Backlog Tasks Completed; Live in Production).

---

## 1. Executive Architectural Summary

**InsideLink** is designed and implemented as an independent high-performance application built on **Next.js 16 (App Router) + Turso (libSQL/SQLite) + Drizzle ORM + Better-Auth (GitHub OAuth) + Tailwind CSS v4**, connected seamlessly to **`https://cristianarando.dev`** using **Reverse-Proxy Rewrites** without altering or endangering the existing multi-language Astro portfolio.

### Core Architecture Invariants
1. **Dual Anti-Collision Fortress:** Both the Vercel rewrite regular expression on `cristianarando.dev` and the `RESERVED_SLUGS` validation engine in `inside-link` strictly block language prefixes (`es`, `en`, `de`, `ru`, `ja` and all 2-letter ISO codes), core portfolio paths (`uses`, `cv`, `projects`, `blog`, etc.), and static file extensions. In addition, static assets are isolated through `assetPrefix` and dedicated `/_next/*` proxy rules.
2. **Adaptive Layout + Keyset Compound Cursor Pagination:** Neither `/admin` nor `/links` loads the entire dataset into memory. They rely on monotonic **ULID** keyset pagination indexed over `(is_pinned DESC, id DESC)` combined with client-side `IntersectionObserver` triggers.
3. **Traffic Segmentation (Human vs. Social Bot vs. Prefetch):** Humans experience sub-50ms instant redirection (`307/301`) paired with non-blocking background telemetry (`after()`). Social crawlers (`WhatsApp`, `LinkedInBot`, `Twitterbot`, `Discordbot`) receive dynamic HTML containing rich Open Graph previews without incrementing `max_clicks` or skewing analytics.
4. **Polymorphic Link Types (`DIRECT` & `HUB`) & PIN Shield:** Links can either perform high-speed URL redirection or present a custom project micro-landing featuring multiple repository, demo, and doc destinations. Sensitive links can be protected with an `scrypt`-derived PIN check and rate-limited unlock interstitial.

---

## 2. Specification Reading Order & Deliverables

| Document | Purpose & Scope |
| :--- | :--- |
| [`01-requerimientos-y-producto.md`](01-requerimientos-y-producto.md) | Blueprint audit, architectural fixes (`C-01` to `C-06`), phased roadmap (`P0`–`P3`), 24 Functional Requirements (`RF-001`..`RF-024`), and 12 Non-Functional Requirements (`RNF-001`..`RNF-012`). |
| [`02-arquitectura-del-sistema.md`](02-arquitectura-del-sistema.md) | Locked technology stack, zero-collision rewrite routing strategy, C4 Architecture models (Levels 1, 2, and 3), and repository structure. |
| [`03-modelo-de-datos-e-invariantes.md`](03-modelo-de-datos-e-invariantes.md) | Entity-Relationship diagrams, Turso/SQLite table dictionary (`links`, `click_events`, `pin_attempts`, `user`/`session`), composite indices, and compound keyset pagination algorithm. |
| [`04-api-flujos-y-motor-redireccion.md`](04-api-flujos-y-motor-redireccion.md) | Slug normalization pipeline, sequence diagrams (`GET /[slug]`, PIN unlock, infinite scroll + debounce), and REST API route contracts. |
| [`05-seguridad-operaciones-y-testing.md`](05-seguridad-operaciones-y-testing.md) | Single-owner authorization model (`ALLOWED_GITHUB_ID`), Open Redirect & XSS defense, `scrypt` hashing, privacy-first zero-raw-IP telemetry, environment variables, and testing strategy. |
| [`06-backlog-de-tareas.md`](06-backlog-de-tareas.md) | Standardized 24-task engineering backlog (`T-001` through `T-024`) with dependency graphs, acceptance criteria, test assertions, and traceability matrix. |
| [`implementation-status.md`](implementation-status.md) | Live execution record of the 24 engineering backlog tasks (`24/24 COMPLETE`). |

---

## 3. Verification & Quality Gates

Every task across the backlog has been verified with production quality gates:
- **Strict TypeScript Validation:** `pnpm typecheck` (0 errors)
- **Automated Test Suite:** `pnpm test` (78 tests passing across 21 test files)
- **Production Compilation:** `pnpm build` (Zero build warnings/errors)
- **Live Deployment:** Verified live under `https://www.cristianarando.dev`
