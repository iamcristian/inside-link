# InsideLink (`cristianarando.dev`) — Flujos de Dominio, Motor de Redirección y Contratos API

> **Estado:** Especificación normativa de comportamiento y contratos HTTP.  
> **Lectura complementaria:** [`01-requerimientos-y-producto.md`](01-requerimientos-y-producto.md) y [`03-modelo-de-datos-e-invariantes.md`](03-modelo-de-datos-e-invariantes.md).

---

## 1. Motor Anti-Colisión y Normalización de Slugs (`src/lib/validations/slug.schema.ts`)

Para proteger todas las rutas actuales y futuras de `cristianarando.dev`, cualquier slug pasa por una tubería determinista de **Normalización $\rightarrow$ Validación Sintáctica $\rightarrow$ Verificación de Lista Negra**:

### 1.1. Tubería de Transformación (`normalizeSlug`)
1. `input.trim().toLowerCase()`
2. Reemplazar secuencias de espacios en blanco (`\s+`) por un único guion medio (`-`).
3. Colapsar guiones repetidos (`--+` $\rightarrow$ `-`).

### 1.2. Reglas de Validación Sintáctica
* **Longitud:** Mínimo `3` caracteres, máximo `100` caracteres.
  * *Justificación:* Bloquear cualquier slug de 1 o 2 caracteres protege automáticamente **todos** los códigos de idioma ISO 639-1 de 2 letras (`es`, `en`, `de`, `ru`, `ja`, `fr`, `pt`, `it`, `zh`, `ko`, etc.) si el portafolio añade más idiomas en el futuro.
* **Expresión Regular Canónica:** `^[a-z0-9]+(?:[-_][a-z0-9]+)*$`
  * Impide puntos (`.`), barras (`/`), caracteres especiales y guiones al inicio o al final.
* **Bloqueo de Extensiones de Archivo:** Cualquier ruta que contenga un punto o termine en extensiones técnicas (`.ico`, `.xml`, `.txt`, `.json`, `.webmanifest`, `.png`, `.jpg`, `.svg`, `.webp`, `.js`, `.css`, `.map`, `.woff2`) es rechazada en el acto sin consultar la base de datos.

### 1.3. Lista Negra Canónica (`RESERVED_SLUGS`)

```typescript
export const RESERVED_SLUGS = new Set([
  // 1. Rutas de idiomas del portafolio (i18n)
  "es", "en", "de", "ru", "ja", "fr", "pt", "it", "zh", "ko",
  // 2. Rutas estáticas y secciones del portafolio
  "uses", "cv", "resume", "projects", "proyectos", "blog", "posts",
  "about", "sobre-mi", "contact", "contacto", "work", "experience",
  "portfolio", "now", "colophon", "testimonials", "services",
  // 3. Rutas del propio sistema InsideLink
  "admin", "dashboard", "login", "logout", "signin", "signout",
  "api", "auth", "links", "hub", "unlock", "qr", "analytics", "settings",
  // 4. Rutas técnicas, frameworks y archivos raíz
  "_next", "_astro", "_il", "_vercel", "assets", "public", "static",
  "images", "fonts", "brand", "favicon", "robots", "sitemap", "manifest",
  "404", "500", "error", "health", "ping"
]);
```

---

## 2. Máquina de Decisión y Flujos de `/[slug]`

### 2.1. Diagrama de Secuencia: Resolución de `/[slug]` (Humano vs. Bot vs. PIN vs. HUB)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Visitante / Bot Social
    participant Proxy as cristianarando.dev (Rewrite)
    participant Handler as GET /[slug] (Next.js)
    participant DB as Turso (libSQL)
    participant After as Next.js after() (Asíncrono)

    Client->>Proxy: GET https://cristianarando.dev/proyecto-guia-turistica?ref=cv
    Proxy->>Handler: Rewrite + Headers (X-Forwarded-For, X-Vercel-IP-Country, User-Agent)
    Handler->>Handler: Validar formato rápido (ignorar .ico/.png o rutas reservadas)
    Handler->>DB: SELECT * FROM links WHERE slug = 'proyecto-guia-turistica' LIMIT 1

    alt Enlace no existe, is_active = 0, expirado o clicks_count >= max_clicks
        Handler-->>Client: 404 Not Found / 410 Gone (Vista temática con botón a cristianarando.dev)
    else Enlace válido y activo
        alt Es Bot de Redes Sociales (WhatsApp, Twitterbot, LinkedInBot, Discordbot...)
            Handler-->>Client: 200 OK (HTML ultraligero con metaetiquetas Open Graph dinámicas)
            Note over Handler,DB: NO incrementa clicks_count ni consume max_clicks
        else Tiene protección por PIN (password_hash != null) y no tiene token de desbloqueo
            Handler-->>Client: 200 OK (Renderiza vista intersticial PinUnlockForm sin exponer destination_url)
        else Es Enlace tipo HUB (Micro-Landing de Proyecto)
            Handler-->>Client: 200 OK (Renderiza tarjeta HUB con botones GitHub, Demo, Docs)
            Handler-)After: Programar registro de visita HUB (si no es prefetch)
            After->>DB: UPDATE clicks_count + 1 & INSERT click_events
        else Es Enlace tipo DIRECT (Redirección Directa)
            Handler->>Handler: Fusionar query params si forward_query_params = 1
            Handler-->>Client: 307 Temporary Redirect (o 301) -> Location: destination_url (<50ms)
            Handler-)After: Programar telemetría fuera del camino crítico (si no es prefetch)
            After->>DB: Transacción: UPDATE clicks_count + 1 & INSERT click_events
        end
    end
```

### 2.2. Reglas de Detección de Bots Sociales y Prefetch (`src/lib/bot-detector.ts`)

1. **Lista de User-Agents de Bots Sociales (`isSocialPreviewBot`):**
   * `WhatsApp`, `facebookexternalhit`, `Facebot`, `Twitterbot`, `LinkedInBot`, `Discordbot`, `Slackbot`, `TelegramBot`, `Pinterest`, `SkypeUriPreview`, `vkShare`, `redditbot`.
   * Cuando `isSocialPreviewBot(userAgent) === true`:
     * El servidor devuelve un documento HTML mínimo (`<head>` con `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card="summary_large_image"`).
     * Si el enlace está protegido por PIN (`password_hash !== null`), el `og:description` muestra `"Enlace protegido con PIN en cristianarando.dev"` y nunca expone información sensible ni el destino.
2. **Detección de Prefetch de Navegador (`isPrefetchRequest`):**
   * Inspecciona headers: `Purpose: prefetch`, `Sec-Purpose: prefetch`, `X-Purpose: preview`, `Next-Router-Prefetch: 1`, `X-Moz: prefetch`.
   * Si es un prefetch, el servidor no ejecuta el bloque `after()` de telemetría para evitar inflar artificialmente `clicks_count` o agotar `max_clicks`.

### 2.3. Diagrama de Secuencia: Desbloqueo de Enlace con PIN (`POST /api/v1/slug/[slug]/unlock`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Visitante Humano
    participant UI as PinUnlockForm (Cliente)
    participant API as POST /api/v1/slug/[slug]/unlock
    participant DB as Turso (libSQL)

    User->>UI: Ingresa PIN y presiona "Desbloquear enlace"
    UI->>API: POST { pin: "1234" }
    API->>DB: Consultar pin_attempts por hash(IP + daily_salt + link_id)
    alt attempts_count >= 5 y window_expires_at > now
        API-->>UI: 429 Too Many Requests (Bloqueado temporalmente por 60s)
    else Dentro del límite permitido
        API->>DB: Obtener link y verificar scryptVerify(pin, link.password_hash)
        alt PIN Incorrecto
            API->>DB: UPSERT pin_attempts (attempts_count + 1)
            API-->>UI: 401 Unauthorized { error: "INVALID_PIN", remainingAttempts }
        else PIN Correcto
            API->>DB: DELETE pin_attempts + Registrar clic válido
            alt link.type === 'DIRECT'
                API-->>UI: 200 OK { type: "DIRECT", destinationUrl: "https://..." }
                UI->>User: window.location.replace(destinationUrl)
            else link.type === 'HUB'
                API-->>UI: 200 OK { type: "HUB", hubLinks: [...] }
                UI->>User: Renderiza los botones del proyecto desbloqueados
            end
        end
    end
```

---

## 3. Flujo de Viewport-Aware Loading (`100vh`) + Infinite Scroll + Búsqueda con Debounce

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador (/admin)
    participant Grid as InfiniteLinkGrid (100vh Layout)
    participant Observer as IntersectionObserver (Sentinel)
    participant API as GET /api/v1/links
    participant DB as Turso (libSQL)

    Admin->>Grid: Carga inicial de /admin
    Grid->>API: GET /api/v1/links?limit=12
    API->>DB: SELECT ... ORDER BY is_pinned DESC, id DESC LIMIT 13
    DB-->>API: 13 filas (indica hasNextPage = true)
    API-->>Grid: { items: [12 links], nextCursor: "eyJwIjowLCJpZCI6IjAxSi4uLiJ9", hasNextPage: true }
    Grid->>Admin: Renderiza lote inicial llenando el viewport sin sobrecargar el DOM

    Admin->>Observer: Hace scroll hasta acercarse al final de la lista
    Observer->>Grid: Dispara callback (rootMargin: "200px")
    Grid->>Grid: Muestra tarjetas Skeleton de carga al final
    Grid->>API: GET /api/v1/links?cursor=eyJwIjowLCJpZCI6IjAxSi4uLiJ9&limit=12
    API->>DB: SELECT ... WHERE (is_pinned < 0) OR (is_pinned = 0 AND id < :id) LIMIT 13
    DB-->>API: Siguiente bloque de enlaces
    API-->>Grid: { items: [...], nextCursor: "...", hasNextPage: ... }
    Grid->>Admin: Anexa suavemente las nuevas tarjetas al DOM

    Admin->>Grid: Escribe "guia" en el buscador
    Note over Grid: Espera 300ms (useDebouncedValue) y cancela peticiones previas (AbortController)
    Grid->>API: GET /api/v1/links?q=guia&category=project&limit=12 (cursor reiniciado)
    API->>DB: SELECT ... WHERE (slug LIKE '%guia%' OR title LIKE '%guia%') ORDER BY is_pinned DESC, id DESC LIMIT 13
    API-->>Grid: Resultados filtrados desde toda la base de datos
```

---

## 4. Contratos de API (`/api/v1/*`)

Todas las respuestas de API siguen una envolvente JSON consistente y códigos de error estructurados:

```typescript
// Respuesta exitosa paginada por cursor
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

// Respuesta de error estándar
export interface ApiErrorResponse {
  error: {
    code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "SLUG_RESERVED"
      | "SLUG_ALREADY_EXISTS"
      | "VALIDATION_ERROR"
      | "INVALID_PIN"
      | "RATE_LIMITED"
      | "LINK_EXPIRED"
      | "INTERNAL_ERROR";
    message: string;
    details?: Record<string, string[]>;
  };
}
```

### 4.1. Resumen de Endpoints

| Método y Ruta | Acceso | Propósito | Parámetros / Payload Clave |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/links` | Admin (`Session`) | Listar enlaces en `/admin` con paginación por cursor, búsqueda y filtros. | Query: `cursor?`, `limit=12` (máx. 50), `q?`, `category?`, `status?` (`all`\|`active`\|`inactive`\|`expired`\|`pinned`). |
| `POST /api/v1/links` | Admin (`Session`) | Crear un nuevo enlace (`DIRECT` o `HUB`). | Body validado por `CreateLinkSchema` (incluye `slug` opcional para autogenerar, `type`, `destinationUrl`, `hubLinks`, `pin`, etc.). |
| `GET /api/v1/links/check-slug` | Admin (`Session`) | Validar en tiempo real si un slug es sintácticamente válido, no está reservado y está libre en BD. | Query: `slug` (y opcionalmente `excludeId` al editar). Devuelve `{ available: boolean, normalizedSlug: string, reason?: string }`. |
| `PATCH /api/v1/links/[id]` | Admin (`Session`) | Actualizar cualquier campo de un enlace o alternar rápidamente `isActive`, `isPinned`, `isPublic`. | Body parcial validado por `UpdateLinkSchema`. |
| `DELETE /api/v1/links/[id]` | Admin (`Session`) | Eliminar un enlace y sus `click_events` en cascada. | — |
| `GET /api/v1/links/[id]/analytics`| Admin (`Session`) | Obtener serie temporal (7d/30d), países, dispositivos, SO y referrers de un enlace o global (`id = 'overview'`). | Query: `range=7d\|30d\|90d`. |
| `GET /api/v1/links/public` | Público | Listar enlaces públicos activos (`is_public = 1 AND is_active = 1` y vigentes) para `/links`. | Query: `cursor?`, `limit=12`, `category?`, `q?`. |
| `POST /api/v1/slug/[slug]/unlock` | Público (Rate-limited)| Verificar PIN de un enlace protegido y devolver destino o sub-enlaces `HUB`. | Body: `{ pin: string }`. |
| `POST /api/v1/slug/[slug]/hub-click`| Público | Registrar clic asíncrono en un botón específico dentro de una micro-landing `HUB`. | Body: `{ subLinkId: string }`. |
