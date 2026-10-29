# InsideLink (`cristianarando.dev`) — Registro de Estado de Implementación

Este archivo rastrea el progreso de ejecución de las 24 tareas definidas en [`docs/06-backlog-de-tareas.md`](06-backlog-de-tareas.md).  
Las tareas se ejecutan secuencialmente respetando sus dependencias. Una tarea solo puede marcarse como `COMPLETE` cuando todos sus criterios de aceptación (`Accept`) y pruebas han pasado.

---

## Resumen de Progreso por Fase

| Fase | Total Tareas | Completadas | En Progreso | Pendientes |
| :--- | :---: | :---: | :---: | :---: |
| **P0: Cimientos, Esquema y Anti-Colisión (`T-001` a `T-005`)** | 5 | 5 | 0 | 0 |
| **P1: MVP Motor y Panel Core (`T-006` a `T-013`)** | 8 | 8 | 0 | 0 |
| **P2: Funciones Pro y Modo HUB (`T-014` a `T-018`)** | 5 | 5 | 0 | 0 |
| **P3: Analíticas, `/links` y Coexistencia (`T-019` a `T-024`)** | 6 | 6 | 0 | 0 |
| **Total** | **24** | **24** | **0** | **0** |

---

## Tablero Detallado de Tareas

| ID | Tarea | Tamaño | Depende de | Estado | Evidencia / Notas |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **T-001** | Inicializar proyecto Next.js, congelar versiones y configurar entorno estricto | `[S]` | Ninguna | `COMPLETE` | Next 16.4.3, React 19.3.0, Turso 0.15.15, Drizzle 0.45.4, Vitest 3.2.7. Build y tests en verde. |
| **T-002** | Configurar cliente Turso (libSQL), esquema Drizzle ORM y migraciones base | `[M]` | `T-001` | `COMPLETE` | Drizzle ORM + @libsql/client configurados. Migración 0000 con CHECK constraints y tests de cascade e invariantes pasando. |
| **T-003** | Implementar el Motor Anti-Colisión, Lista Negra de Rutas y Esquemas Zod de Slugs | `[S]` | `T-001` | `COMPLETE` | RESERVED_SLUGS, normalizeSlug y esquemas Zod (SlugSchema, CreateLinkSchema, SafeUrlSchema) con 14 tests unitarios en verde. |
| **T-004** | Implementar el Codificador de Cursor Compuesto y Utilidades de Clasificación HTTP | `[S]` | `T-001` | `COMPLETE` | encodeLinkCursor, decodeLinkCursor, isSocialPreviewBot, isPrefetchRequest y extractTrafficMetadata con 7 tests unitarios en verde. |
| **T-005** | Crear Script de Semilla (Seed) y Datos de Prueba para Desarrollo Local | `[S]` | `T-002`, `T-003`, `T-004` | `COMPLETE` | Seed idempotente ejecutado con éxito en local.db: 18 enlaces representativos y 120 eventos de telemetría. |
| **T-006** | Configurar Autenticación GitHub OAuth con Bloqueo de Propietario Único (`Better-Auth`) | `[M]` | `T-002` | `COMPLETE` | Better-Auth con hook databaseHooks.account.create.before bloqueando accountId != ALLOWED_GITHUB_ID, helper requireAdminSession y vista /login. Tests de integración pasando. |
| **T-007** | Implementar el Servicio de Dominio de Enlaces (CRUD, Slugs Aleatorios y Paginación por Cursor) | `[M]` | `T-002`, `T-003`, `T-004` | `COMPLETE` | LinkService (CRUD, ULID monótonos, checkSlugAvailability, random slugs, keyset pagination sobre (is_pinned DESC, id DESC), búsqueda y aislamiento público) con 20 tests de integración en verde. |
| **T-008** | Implementar el Servicio de Resolución de `/[slug]` y Ruta de Redirección Directa | `[M]` | `T-004`, `T-007` | `COMPLETE` | ResolutionService + GET /[slug] (307/301, forward_query_params, 404, 410 Gone, exclusión de bots/prefetch, telemetría asíncrona con after()) y vista 404. 5 tests de integración en verde. |
| **T-009** | Exponer Route Handlers de API para Gestión de Enlaces (`/api/v1/links/*`) | `[M]` | `T-006`, `T-007` | `COMPLETE` | Endpoints GET/POST /api/v1/links, GET /api/v1/links/check-slug y PATCH/DELETE /api/v1/links/[id] protegidos con sesión y verificados con tests de integración. |
| **T-010** | Construir Hooks de Cliente (`useInfiniteScroll`, `useDebouncedValue`) y Primitivas UI Base | `[S]` | `T-001` | `COMPLETE` | Hooks useInfiniteScroll + useDebouncedValue, catálogo de iconos (Brand + Lucide) y primitivas UI accesibles con 5 tests unitarios en verde. |
| **T-011** | Construir el Layout `100vh` de `/admin` y la Cuadrícula con Infinite Scroll (`InfiniteLinkGrid`) | `[M]` | `T-009`, `T-010` | `COMPLETE` | Layout `/admin`, `AdminToolbar`, `LinkCard` e `InfiniteLinkGrid` con cursor compuesto, búsqueda con debounce (300ms) y AbortController. |
| **T-012** | Construir el Modal de Creación/Edición de Enlaces con Validación de Slug en Tiempo Real | `[M]` | `T-009`, `T-011` | `COMPLETE` | `LinkFormModal` e `IconPicker` con normalización en vivo, autogeneración de 6 caracteres y validación asíncrona contra `/api/v1/links/check-slug`. |
| **T-013** | Cierre de Fase P1: Verificación Integral del MVP | `[S]` | `T-008`, `T-011`, `T-012` | `COMPLETE` | `tests/integration/mvp-flow.test.ts` + `pnpm typecheck`, `pnpm test` y `pnpm build` con 0 errores. |
| **T-014** | Implementar Inyección Dinámica de Open Graph para Bots de Redes Sociales | `[M]` | `T-008` | `COMPLETE` | `og-render.service.ts` integrado en `GET /[slug]` y verificado con `tests/integration/bot-opengraph.test.ts` (WhatsApp/LinkedInBot no consumen `max_clicks`). |
| **T-015** | Implementar el Modo Micro-Landing de Proyecto (`type = 'HUB'`) | `[M]` | `T-008`, `T-012` | `COMPLETE` | `HubLandingView`, `HubLinksEditor`, `POST /api/v1/slug/[slug]/hub-click` y `tests/integration/hub-landing.test.ts` en verde. |
| **T-016** | Implementar Protección con PIN / Contraseña y Rate Limiting (`scrypt` + Intersticial) | `[M]` | `T-008`, `T-015` | `COMPLETE` | `rate-limit.ts` (máx. 5 fallos / 60s), `PinUnlockForm`, `POST /api/v1/slug/[slug]/unlock` y `tests/integration/pin-protection.test.ts` en verde. |
| **T-017** | Implementar Controles de Caducidad Automática (`expires_at` y `max_clicks`) | `[S]` | `T-008`, `T-012` | `COMPLETE` | `ExpiredLinkView` (HTTP 410 Gone) y `tests/integration/link-expiration.test.ts` verificados. |
| **T-018** | Implementar Generador y Descargador de Códigos QR Personalizados (SVG y PNG) | `[S]` | `T-011` | `COMPLETE` | `qr-generator.ts`, `QrCodeModal`, `public/brand/logo-qr.svg` y `tests/unit/qr-generator.test.ts` apuntando siempre a `https://cristianarando.dev/[slug]`. |
| **T-019** | Implementar Servicio de Telemetría Asíncrona y Agregaciones Analíticas | `[M]` | `T-004`, `T-008` | `COMPLETE` | `analytics.service.ts` + `GET /api/v1/links/[id]/analytics` + `tests/integration/analytics-service.test.ts` (sin IPs almacenadas). |
| **T-020** | Construir el Panel Visual de Analíticas por Enlace y Global (`/admin/analytics`) | `[M]` | `T-011`, `T-019` | `COMPLETE` | `analytics-charts.tsx`, `analytics-drawer.tsx` y `/admin/analytics` con selector `7d` / `30d` / `90d`. |
| **T-021** | Construir el Directorio Público (`/links`) con Pestañas por Categoría e Infinite Scroll | `[M]` | `T-007`, `T-010` | `COMPLETE` | `GET /api/v1/links/public`, `PublicLinkDirectory`, `/links` y `tests/integration/public-directory.test.ts` en verde. |
| **T-022** | Preparar Artefactos de Coexistencia (`vercel.json` / Cloudflare Rules) y Verificación de Headers | `[S]` | `T-008`, `T-021` | `COMPLETE` | `vercel.rewrites.json`, `cloudflare-worker-proxy.example.ts`, `src/middleware.ts` y `tests/unit/rewrite-regex.test.ts` en verde. |
| **T-023** | Suite de Pruebas End-to-End (Playwright) y Auditoría de Seguridad / Accesibilidad | `[M]` | `T-014`..`T-022` | `COMPLETE` | `playwright.config.ts`, `tests/e2e/public-and-redirect.spec.ts` y `tests/e2e/admin-and-hub.spec.ts` en verde. |
| **T-024** | Documentación Operativa Final y Gate de Lanzamiento a Producción | `[S]` | `T-023` | `COMPLETE` | `README.md` raíz, 21 archivos de prueba (78 tests) pasando, `tsc --noEmit` y `next build` con 0 errores. |
