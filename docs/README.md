# InsideLink (`cristianarando.dev`) — Suite de Arquitectura y Plan de Implementación

> **Aplicación:** `inside-link` (Sistema de Gestión de Enlaces, Micro-Landings de Proyecto y Directorio Público para `cristianarando.dev`)  
> **Fecha de Preparación:** 2026-10-26  
> **Estado:** Planificación y estandarización completadas (`24` tareas acotadas en backlog; implementación en `NOT_STARTED`).

---

## 1. Resumen Ejecutivo de la Arquitectura

**InsideLink** se implementa como un proyecto independiente en **Next.js 16 (App Router) + Turso (libSQL/SQLite) + Drizzle ORM + Better-Auth (GitHub OAuth) + Tailwind CSS v4 + shadcn/ui**, conectado de forma transparente a **`cristianarando.dev`** mediante reglas de **Rewrite / Reverse Proxy** sin tocar ni arriesgar el portafolio multi-idioma actual.

### Decisiones Clave e Invariantes
1. **Doble Barrera Anti-Colisión:** Tanto la regla de Rewrite en `cristianarando.dev` como el validador `RESERVED_SLUGS` en `inside-link` bloquean idiomas (`es`, `en`, `de`, `ru`, `ja` y cualquier código de 2 letras), rutas del portafolio (`uses`, `cv`, `projects`, `blog`, etc.) y extensiones de archivos estáticos, además de aislar assets mediante `assetPrefix`.
2. **Carga Adaptativa `100vh` + Infinite Scroll por Cursor Compuesto:** Ni `/admin` ni `/links` cargan toda la base de datos de golpe. Usan *keyset pagination* sobre `(is_pinned DESC, id DESC)` con identificadores **ULID** e `IntersectionObserver`.
3. **Diferenciación Humano vs. Bot Social vs. Prefetch:** Los humanos reciben redirección instantánea (`<50ms`) con telemetría asíncrona (`after()`), mientras que los bots (`WhatsApp`, `LinkedInBot`, `Twitterbot`, `Discordbot`) reciben HTML con Open Graph personalizado sin consumir `max_clicks`.
4. **Enlaces Polimórficos (`DIRECT` y `HUB`) y Protección por PIN:** Un enlace puede redirigir directamente o desplegar una micro-landing con los recursos de un proyecto (GitHub, Demo, Docs), con opción de bloqueo por PIN cifrado con `scrypt` y *rate limiting*.

---

## 2. Orden de Lectura y Entregables de Especificación

| Documento | Contenido Normativo |
| :--- | :--- |
| [`01-requerimientos-y-producto.md`](01-requerimientos-y-producto.md) | Análisis y correcciones al blueprint original (`C-01` a `C-06`), alcance por fases (`P0`–`P3`), `24` Requerimientos Funcionales (`RF-001`..`RF-024`) y `12` No Funcionales (`RNF-001`..`RNF-012`). |
| [`02-arquitectura-del-sistema.md`](02-arquitectura-del-sistema.md) | Stack tecnológico fijado, estrategia de Rewrites sin colisión de `/_next/static/*`, diagramas C4 (Niveles 1, 2 y 3) y árbol completo del repositorio. |
| [`03-modelo-de-datos-e-invariantes.md`](03-modelo-de-datos-e-invariantes.md) | Diagrama Entidad-Relación, diccionario de tablas en Turso/SQLite (`links`, `click_events`, `pin_attempts`, `user`/`session`), índices y algoritmo de cursor compuesto `(is_pinned, id)`. |
| [`04-api-flujos-y-motor-redireccion.md`](04-api-flujos-y-motor-redireccion.md) | Tubería de normalización de slugs, diagramas de secuencia (`/[slug]`, desbloqueo PIN, Infinite Scroll + Debounce) y contratos de endpoints `/api/v1/*`. |
| [`05-seguridad-operaciones-y-testing.md`](05-seguridad-operaciones-y-testing.md) | Bloqueo `ALLOWED_GITHUB_ID`, prevención de Open Redirect/XSS, hashing de PIN, privacidad sin IP cruda, variables de entorno y estrategia de pruebas (Vitest + Playwright). |
| [`06-backlog-de-tareas.md`](06-backlog-de-tareas.md) | **Backlog estandarizado de 24 tareas (`T-001` a `T-024`)** con dependencias, rutas de salida, pasos, criterios de aceptación, matriz de trazabilidad y prompt de ejecución. |
| [`implementation-status.md`](implementation-status.md) | Registro vivo de progreso de las 24 tareas (`NOT_STARTED` $\rightarrow$ `COMPLETE`). |

---

## 3. Cómo Iniciar la Implementación

1. Comienza por **`T-001`** en [`06-backlog-de-tareas.md`](06-backlog-de-tareas.md).
2. Ejecuta una tarea a la vez verificando sus criterios de aceptación (`Accept`) con comandos reales (`pnpm typecheck`, `pnpm test`, `pnpm build`).
3. Actualiza [`implementation-status.md`](implementation-status.md) al finalizar cada tarea antes de pasar a la siguiente.
