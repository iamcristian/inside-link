# InsideLink (`cristianarando.dev`) — Seguridad, Operaciones y Estrategia de Pruebas

> **Estado:** Especificación normativa de controles de seguridad, variables de entorno y matriz de verificación.  
> **Lectura complementaria:** [`01-requerimientos-y-producto.md`](01-requerimientos-y-producto.md) y [`04-api-flujos-y-motor-redireccion.md`](04-api-flujos-y-motor-redireccion.md).

---

## 1. Autenticación Exclusiva de Propietario (Single-Owner Lock)

El panel `/admin` y todos los endpoints administrativos están diseñados para un único propietario (**Cristian Arando**). No existe registro abierto de usuarios.

### 1.1. Regla de Bloqueo en `Better-Auth`
1. El único proveedor habilitado es **GitHub OAuth** (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`).
2. Se define la variable de entorno obligatoria `ALLOWED_GITHUB_ID` (ID numérico inmutable de tu cuenta de GitHub) y opcionalmente `ALLOWED_GITHUB_EMAIL`.
3. En la configuración del servidor (`src/server/auth/config.ts`), se intercepta el ciclo de creación/inicio de sesión:
   * Antes de persistir una cuenta o sesión en Turso, se compara el `accountId` devuelto por la API de GitHub con `process.env.ALLOWED_GITHUB_ID`.
   * Si no coincide exactamente, se lanza un `APIError("FORBIDDEN", { message: "Acceso restringido exclusivamente al propietario del dominio." })`.
   * Ningún dato del usuario intruso se guarda en la tabla `user` ni `session`.
4. **Fallo Seguro en Arranque (Fail-Closed):** Si `ALLOWED_GITHUB_ID` o `BETTER_AUTH_SECRET` están vacíos o ausentes al iniciar el servidor, la validación de entorno (`src/lib/env.ts`) detiene el arranque inmediatamente.

---

## 2. Seguridad en Redirecciones, Destinos y PIN

### 2.1. Prevención de XSS y Open Redirect Malicioso (`RNF-003`)
* Todo `destination_url` y cada `url` dentro de `hub_links_json` debe parsearse con `new URL(input)` y verificar que `url.protocol === "https:" || url.protocol === "http:"`.
* Se rechazan explícitamente esquemas peligrosos (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) y autoreferencias recursivas infinitas hacia el mismo slug (`https://cristianarando.dev/[mismo-slug]`).
* Al fusionar `Query Strings` cuando `forward_query_params = true`:
  * Solo se copian pares clave-valor hacia `targetUrl.searchParams`.
  * Jamás se permite que un query string modifique el `hostname`, `protocol` o `pathname` de la URL de destino.

### 2.2. Criptografía de PIN y Control Anti-Fuerza Bruta (`RNF-005`)
* **Almacenamiento del PIN:** Nunca se guarda en texto plano. Se utiliza `node:crypto` (`scryptSync` / `scrypt`) con un `salt` aleatorio de 16 bytes por enlace, almacenado con formato `v1:<salt_hex>:<hash_hex>`.
* **Comparación en Tiempo Constante:** La verificación utiliza `crypto.timingSafeEqual` para impedir ataques de temporización (*timing attacks*).
* **No-Cache en Enlaces con PIN:** Un enlace con `password_hash !== null` nunca emite código `301` ni encabezados de caché públicos (`Cache-Control: private, no-store, no-cache, must-revalidate`).
* **Rate Limiting:** Máximo `5` intentos fallidos en una ventana de `60` segundos por combinación `(IP_Hashed + link_id)` registrada en la tabla `pin_attempts`.

---

## 3. Privacidad y Extracción de Cabeceras tras Reverse Proxy

Cuando el tráfico pasa por `cristianarando.dev` hacia el despliegue de `inside-link`, la extracción de metadatos (`src/lib/geo-headers.ts`) sigue una cadena de prioridad determinista y respetuosa con la privacidad (`RNF-006`):

1. **País (`country`):**
   * Prioridad: `x-vercel-ip-country` $\rightarrow$ `cf-ipcountry` $\rightarrow$ `'XX'`.
   * Se valida que sea un código ISO-3166-1 alpha-2 de 2 letras mayúsculas (`^[A-Z]{2}$`).
2. **Ciudad (`city`):**
   * Prioridad: `x-vercel-ip-city` (decodificado con `decodeURIComponent`) $\rightarrow$ `cf-ipcity` $\rightarrow$ `null`.
3. **Origen (`referrer`):**
   * Se lee el encabezado `referer`. Si es una URL válida, se extrae únicamente su `hostname` sin `www.` (ej. `linkedin.com`, `github.com`, `t.co`, `wa.me`). Si no existe o es inválido, se registra `'Direct'`.
4. **Cero Almacenamiento de IP Cruda:**
   * La dirección IP (`x-forwarded-for` / `x-real-ip`) **nunca** se escribe en `click_events`.
   * Solo se utiliza en memoria junto con un secreto diario para generar el hash anónimo de `pin_attempts.key` en enlaces protegidos por PIN.

---

## 4. Contrato de Variables de Entorno (`src/lib/env.ts`)

Validado en tiempo de arranque mediante Zod:

```env
# Base de Datos (Turso / libSQL)
# En desarrollo local usar: file:local.db
TURSO_DATABASE_URL="file:local.db"
TURSO_AUTH_TOKEN=""

# Autenticación (Better-Auth + GitHub OAuth)
BETTER_AUTH_SECRET="generar_secreto_de_al_menos_32_bytes_hex"
BETTER_AUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="tu_github_oauth_client_id"
GITHUB_CLIENT_SECRET="tu_github_oauth_client_secret"

# Bloqueo de Propietario Único (Obligatorio)
ALLOWED_GITHUB_ID="tu_id_numerico_de_github"
ALLOWED_GITHUB_EMAIL="tu_correo_verificado_opcional"

# Dominio Canónico y Coexistencia por Proxy
NEXT_PUBLIC_CANONICAL_URL="https://cristianarando.dev"
NEXT_PUBLIC_ASSET_PREFIX=""
```

---

## 5. Estrategia de Pruebas y Matriz de Verificación

Cada tarea del backlog (`T-001` a `T-024`) exige evidencia ejecutable antes de marcarse como `COMPLETE`.

| Nivel de Prueba | Herramienta | Alcance Obligatorio |
| :--- | :--- | :--- |
| **Unitarias (`tests/unit/`)** | Vitest | Normalizador de slugs, lista negra `RESERVED_SLUGS`, bloqueo de extensiones y 2 letras, codificador/decodificador de cursor compuesto `(is_pinned, id)`, detector de bots sociales vs humanos vs prefetch, hashing/verificación de PIN y extractor de headers Geo/Referrer. |
| **Integración (`tests/integration/`)** | Vitest + `@libsql/client` (`file::memory:` o archivo temporal por test) | Migraciones Drizzle, restricciones `CHECK` (`DIRECT` vs `HUB`), paginación por cursor sin duplicados ni saltos al fijar enlaces, resolución de `/[slug]` (activo, inactivo, expirado, `max_clicks` agotado, bot OG, PIN), e ingesta atómica de `click_events`. |
| **End-to-End (`tests/e2e/`)** | Playwright | Flujo de redirección `/[slug]`, renderizado de micro-landing `HUB`, desbloqueo con PIN, visualización y filtrado de `/links` con Infinite Scroll, y protección de `/admin` redirigiendo usuarios no autenticados a `/login`. |
