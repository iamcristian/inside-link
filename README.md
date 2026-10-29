# InsideLink — Acortador de Enlaces, Micro-Landings (`HUB`) y Directorio `/links` para `cristianarando.dev`

**InsideLink** es la plataforma propietaria de enlaces cortos (`cristianarando.dev/[slug]`), micro-landings de proyectos (`type = 'HUB'`), códigos QR vectoriales y directorio público (`/links`) diseñada para coexistir sin colisiones bajo el dominio principal **`https://cristianarando.dev`**.

---

## 1. Stack Tecnológico (Abril 2026)

| Capa | Tecnología |
| :--- | :--- |
| **Runtime & Gestor** | Node.js `v24.11.1` LTS + `pnpm` |
| **Framework Full-Stack** | Next.js `16.4.3` (App Router, Turbopack, `after()` API) + React `19.3.0` |
| **Base de Datos Edge** | Turso (`@libsql/client` SQLite/libSQL) + Drizzle ORM |
| **Autenticación** | Better-Auth (`GitHub OAuth` con bloqueo exclusivo por `ALLOWED_GITHUB_ID`) |
| **Validación & Criptografía** | Zod + `ulidx` (ULIDs monótonos) + `node:crypto` (`scrypt` + `timingSafeEqual`) |
| **Estilos & Testing** | Tailwind CSS v4 + Vitest (Unit, Integration & E2E) |

---

## 2. Desarrollo Local Rápido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno (configurado por defecto con file:local.db)
cp .env.example .env

# 3. Ejecutar migraciones SQLite y poblar semilla idempotente (18 enlaces + 120 eventos)
pnpm db:migrate
pnpm db:seed

# 4. Iniciar servidor de desarrollo en http://localhost:3000
pnpm dev
```

### Comandos de Verificación y Calidad

```bash
pnpm typecheck   # Verificación estricta TypeScript (0 errores)
pnpm test        # Suite completa Vitest (Unit + Integration + E2E)
pnpm build       # Compilación de producción Next.js 16
```

---

## 3. Despliegue en Producción (Turso + Vercel + Coexistencia con Portafolio)

### Paso 1: Crear base de datos en Turso CLI

```bash
turso db create inside-link
turso db show inside-link --url
turso db tokens create inside-link
```

### Paso 2: Configurar Variables de Entorno en Vercel

Configura las siguientes variables en el proyecto `inside-link` en Vercel:

* `TURSO_DATABASE_URL`: URL `libsql://...` obtenida de Turso.
* `TURSO_AUTH_TOKEN`: Token de lectura/escritura de Turso.
* `BETTER_AUTH_SECRET`: Secreto aleatorio de $\ge 32$ caracteres (`openssl rand -base64 32`).
* `BETTER_AUTH_URL`: `https://cristianarando.dev`
* `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`: Credenciales de tu GitHub OAuth App (Callback: `https://cristianarando.dev/api/auth/callback/github`).
* `ALLOWED_GITHUB_ID`: Tu ID numérico inmutable de GitHub (`https://api.github.com/users/Crisutf`).
* `NEXT_PUBLIC_APP_URL`: `https://cristianarando.dev`
* `NEXT_PUBLIC_CANONICAL_URL`: `https://cristianarando.dev`
* `NEXT_PUBLIC_ASSET_PREFIX`: `https://inside-link-cris.vercel.app` (evita colisiones de `/_next/static/*` con el portafolio principal).

### Paso 3: Conectar Rewrites en el repositorio del Portafolio (`cristianarando.dev`)

Copia las reglas de [`docs/portfolio-integration/vercel.rewrites.json`](docs/portfolio-integration/vercel.rewrites.json) en el `vercel.json` del portafolio principal (o utiliza [`docs/portfolio-integration/cloudflare-worker-proxy.example.ts`](docs/portfolio-integration/cloudflare-worker-proxy.example.ts) en Cloudflare).

---

## 4. Documentación de Ingeniería

Toda la especificación arquitectónica se encuentra en [`docs/README.md`](docs/README.md):

1. [`docs/01-requerimientos-y-producto.md`](docs/01-requerimientos-y-producto.md) — 24 RF, 12 RNF y 6 correcciones arquitectónicas.
2. [`docs/02-arquitectura-del-sistema.md`](docs/02-arquitectura-del-sistema.md) — Diagramas C4 (Niveles 1–3) y estrategia de coexistencia.
3. [`docs/03-modelo-de-datos-e-invariantes.md`](docs/03-modelo-de-datos-e-invariantes.md) — Esquema Turso/SQLite, índices y cursor compuesto `(is_pinned, id)`.
4. [`docs/04-api-flujos-y-motor-redireccion.md`](docs/04-api-flujos-y-motor-redireccion.md) — Máquina de estados de `GET /[slug]` y contratos REST.
5. [`docs/05-seguridad-operaciones-y-testing.md`](docs/05-seguridad-operaciones-y-testing.md) — Seguridad propietario único, PIN `scrypt` y privacidad sin IPs.
6. [`docs/06-backlog-de-tareas.md`](docs/06-backlog-de-tareas.md) — Backlog de 24 tareas (`T-001`..`T-024`).
7. [`docs/implementation-status.md`](docs/implementation-status.md) — Estado de implementación (`24/24 COMPLETE`).
