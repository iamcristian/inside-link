# InsideLink (`cristianarando.dev`) — Especificación de Requerimientos y Producto

> **Nombre del Proyecto:** `inside-link` (Sistema de Gestión de Enlaces, Micro-Landings y Directorio Público para `cristianarando.dev`)  
> **Fecha de Especificación:** 2026-10-26  
> **Estado:** Planificación y estandarización completadas; implementación de código aún no iniciada (`NOT_STARTED`).  
> **Propiedad de Especificación:** Este documento (`01`) gobierna el alcance funcional y los criterios de aceptación observables; [`02-arquitectura-del-sistema.md`](02-arquitectura-del-sistema.md) gobierna la topología y coexistencia con el portafolio; [`03-modelo-de-datos-e-invariantes.md`](03-modelo-de-datos-e-invariantes.md) gobierna la persistencia en Turso/Drizzle; [`04-api-flujos-y-motor-redireccion.md`](04-api-flujos-y-motor-redireccion.md) gobierna contratos HTTP y flujos; [`05-seguridad-operaciones-y-testing.md`](05-seguridad-operaciones-y-testing.md) gobierna seguridad y pruebas; [`06-backlog-de-tareas.md`](06-backlog-de-tareas.md) gobierna la secuencia de implementación.

---

## 1. Definición del Producto y Propósito

**InsideLink** es una plataforma personal de gestión de enlaces cortos, micro-landings de proyectos (`HUB`) y directorio público (`/links`), diseñada para operar de forma transparente bajo el dominio principal **`cristianarando.dev`** sin interferir con el portafolio multi-idioma existente.

Inspirado en `midu.link`, **InsideLink** resuelve sus limitaciones arquitectónicas y de experiencia de usuario mediante:
1. **Coexistencia desacoplada por Reverse Proxy / Rewrites:** Repositorio y despliegue independientes que interceptan únicamente las rutas no reservadas por el portafolio.
2. **Carga adaptativa al Viewport (`100vh`) + Infinite Scroll real:** Paginación basada en cursor compuesto `(is_pinned, id)` e `IntersectionObserver`, evitando renderizar cientos de nodos DOM de golpe.
3. **Enlaces Polimórficos (`DIRECT` vs. `HUB`):** Soporte tanto para redirección instantánea (`307`/`301`) como para micro-landings de proyecto con múltiples enlaces (Repositorio GitHub, Demo en vivo, Documentación, Video).
4. **Detección inteligente de Bots sociales (Open Graph Dinámico):** Redirección en $<50\text{ ms}$ para humanos y respuesta HTML con metadatos Open Graph personalizados para bots (`WhatsApp`, `Twitterbot`, `LinkedInBot`, `Discordbot`) sin consumir límites de clics.

---

## 2. Correcciones y Mejoras Realizadas sobre el Blueprint Original

Durante el análisis de ingeniería del documento base, se identificaron y corrigieron los siguientes vacíos técnicos para garantizar una implementación libre de colisiones y deuda técnica:

| # | Hallazgo en el Blueprint Original | Corrección Estandarizada en esta Especificación |
| :--- | :--- | :--- |
| **C-01** | **Colisión de `/_next/static/*` en Rewrites:** Si el portafolio y el sistema de links usan frameworks web modernos bajo el mismo dominio, las rutas de assets estáticos pueden chocar al hacer proxy. | Se define `assetPrefix` dedicado (o subruta `/_il` para recursos internos) y encabezados `X-Forwarded-Host` explícitos en [`02-arquitectura-del-sistema.md`](02-arquitectura-del-sistema.md). |
| **C-02** | **Tipos de PostgreSQL en SQLite/Turso:** La tabla sugerida usaba `UUID`, `ENUM`, `JSONB` y `TIMESTAMP`, pero el stack elegido es **Turso (libSQL/SQLite)** + **Drizzle ORM**. | Se estandariza el esquema en `sqlite-core` usando **ULID** (`TEXT` de 26 caracteres ordenable lexicográficamente), validación `CHECK` en SQL para enums/invariantes, `TEXT` validado con Zod para estructuras JSON, e `INTEGER` (Unix epoch ms) para marcas de tiempo. |
| **C-03** | **Campos faltantes en tabla `links`:** Los requerimientos hablaban de código `301/307`, límite máximo de clics, icono personalizado, imagen Open Graph y paso de query params, pero ninguno existía en el esquema de base de datos. | Se incorporan formalmente `redirect_status`, `max_clicks`, `icon`, `og_image_url`, `forward_query_params`, `tags_json` y `updated_at` en [`03-modelo-de-datos-e-invariantes.md`](03-modelo-de-datos-e-invariantes.md). |
| **C-04** | **Bots agotando `max_clicks`:** Si un enlace tiene límite de 1 clic y se envía por WhatsApp, el bot de previsualización de WhatsApp consumiría el único clic antes que el destinatario. | Los bots de redes sociales y peticiones `prefetch` del navegador se excluyen estrictamente del incremento de `clicks_count` y de la evaluación de `max_clicks`. |
| **C-05** | **Cursor de paginación roto con enlaces fijados (`is_pinned`):** Ordenar por `is_pinned DESC, created_at DESC` rompe un cursor simple basado solo en `id`. | Se implementa un **cursor compuesto** codificado en Base64URL (`{ p: 0|1, id: string }`) con comparación lexicográfica exacta sobre `(is_pinned, id)`. |
| **C-06** | **Fuga de URL en enlaces con PIN:** Un enlace con contraseña no puede responder con `307 Location: destino` hasta validar el PIN en el servidor. | Las rutas protegidas por PIN renderizan una vista intersticial de desbloqueo con *rate-limiting* y solo revelan la URL tras verificar el hash en el backend. |

---

## 3. Actores y Modelo de Permisos

| Actor | Actividades Permitidas | Restricciones de Seguridad |
| :--- | :--- | :--- |
| **Visitante Humano** | Acceder a `/[slug]` (redirección o vista `HUB`), desbloquear enlaces con PIN válido, explorar el directorio público `/links`, filtrar por categoría y buscar enlaces públicos. | No puede enumerar enlaces privados (`is_public = false`), ver analíticas ni acceder a `/admin`. |
| **Bot de Redes Sociales / Crawler** | Solicitar `/[slug]` y recibir HTML con metaetiquetas Open Graph / Twitter Cards personalizadas. | No incrementa `clicks_count`, no consume `max_clicks`, ni puede extraer el `destination_url` de enlaces protegidos por PIN. |
| **Administrador Propietario (Cristian)** | Iniciar sesión vía GitHub OAuth, gestionar el CRUD completo de enlaces, fijar enlaces, descargar QR, configurar PIN/expiración y visualizar analíticas detalladas. | Acceso restringido por hardware/configuración al `ALLOWED_GITHUB_ID` único del propietario. Cualquier otra cuenta de GitHub es rechazada antes de crear sesión. |

---

## 4. Fases de Alcance del Producto (Release Scope)

| Fase | Nombre | Propósito | Condición de Salida (Exit Gate) |
| :--- | :--- | :--- | :--- |
| **P0** | **Cimientos, Esquema y Anti-Colisión** | Congelar versiones, configurar Next.js + Turso + Drizzle, definir el validador de rutas reservadas y preparar el entorno local y CI. | `pnpm install`, migraciones en libSQL local, tests unitarios del validador de slugs y `typecheck` en verde. |
| **P1** | **MVP: Motor de Redirección y Panel Core** | Autenticación GitHub OAuth exclusiva, motor `/[slug]` con telemetría asíncrona, CRUD de enlaces `DIRECT` y Dashboard `100vh` con Infinite Scroll y búsqueda. | Un enlace creado en `/admin` redirige en `<50ms` (local/edge), respeta la lista negra y pagina correctamente por cursor. |
| **P2** | **Funciones Pro (Superando a `midu.link`)** | Modo `HUB` (Micro-landing multi-enlace), Open Graph dinámico para bots, protección por PIN, expiración por fecha/clics y generador de QR estilizado. | Bots reciben OG tags sin gastar clics; enlaces con PIN exigen código; QR descarga en SVG/PNG con logo. |
| **P3** | **Analíticas, Directorio `/links` y Coexistencia** | Panel de métricas por enlace/globales, vista pública `/links` con Infinite Scroll y configuración de Rewrites con `cristianarando.dev`. | Pruebas E2E pasando, reglas de Rewrite verificadas sin colisión de assets ni pérdida de headers Geo/IP. |

---

## 5. Requerimientos Funcionales (RF)

### 5.1. Prevención de Colisiones y Validación de Slugs

| ID | Requerimiento | Fase | Criterio de Aceptación Observable |
| :--- | :--- | :--- | :--- |
| **RF-001** | **Lista Negra de Rutas Reservadas (Blacklist):** Bloquear la creación de slugs que coincidan con rutas de idiomas (`es`, `en`, `de`, `ru`, `ja`), rutas del portafolio (`uses`, `cv`, `resume`, `projects`, `blog`, `about`, `contact`, `work`), rutas del sistema (`admin`, `dashboard`, `login`, `api`, `links`, `auth`, `404`) y rutas técnicas (`_next`, `_astro`, `_il`, `assets`, `public`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`). | P0 | Intentar crear o actualizar un enlace con cualquiera de estos slugs (o subrutas derivadas) falla con código `422 SLUG_RESERVED` tanto en el cliente como en el servidor. |
| **RF-002** | **Normalización y Reglas Sintácticas de Slug:** Convertir entradas a minúsculas, transformar espacios intermedios en guiones medios (`-`), exigir longitud entre `3` y `100` caracteres (bloqueando todos los códigos ISO 639-1 de 2 letras futuros), permitir únicamente `^[a-z0-9]+(?:[-_][a-z0-9]+)*$` y rechazar extensiones de archivo (`.ico`, `.png`, `.xml`, `.json`, `.txt`, `.js`, `.css`). | P0 | `"  Proyecto Guia Turistica  "` se normaliza a `"proyecto-guia-turistica"`. Slugs de 1 o 2 caracteres (`"fr"`, `"pt"`), con puntos (`"file.json"`) o guiones extremos (`"-test"`) son rechazados por el esquema Zod compartido. |
| **RF-003** | **Generación Automática de Slug:** Permitir generar un slug aleatorio criptográficamente seguro de 6 caracteres alfanuméricos en minúsculas (`[a-z0-9]{6}`) libre de colisiones y fuera de la lista negra. | P1 | Si el usuario solicita autogeneración, el sistema produce un slug de 6 caracteres único verificando inexistencia previa en la base de datos. |

### 5.2. Motor de Redirección y Micro-Landings (`/[slug]`)

| ID | Requerimiento | Fase | Criterio de Aceptación Observable |
| :--- | :--- | :--- | :--- |
| **RF-004** | **Resolución de Enlaces `DIRECT`:** Resolver slugs activos de tipo `DIRECT` y emitir respuesta HTTP con el código configurado (`307` por defecto o `301` si se configuró permanente). | P1 | `GET /github` en un enlace activo sin PIN devuelve `307 Temporary Redirect` (o `301`) con header `Location` apuntando exactamente a `destination_url`. |
| **RF-005** | **Paso de Query Strings (`forward_query_params`):** Cuando un enlace tiene habilitado `forward_query_params = true`, preservar y fusionar los parámetros de consulta entrantes (ej. `?ref=cv&utm_source=linkedin`) en la URL de destino sin sobrescribir parámetros críticos maliciosamente. | P1 | `GET /linkedin?ref=cv` hacia `https://linkedin.com/in/cristian` redirige a `https://linkedin.com/in/cristian?ref=cv`. |
| **RF-006** | **Manejo de Enlaces Inexistentes, Pausados o Expirados:** Si el slug no existe, tiene `is_active = false`, superó `expires_at` o alcanzó `max_clicks`, mostrar una vista `/404` o estado temático limpio con enlace de retorno a `https://cristianarando.dev`. | P1/P2 | Nunca redirige un enlace inactivo o vencido; responde con HTTP `404` (si no existe) o `410 Gone` (si expiró/alcanzó límite de clics) con interfaz coherente con el portafolio. |
| **RF-007** | **Vista Previa Inteligente para Bots (Open Graph Dinámico):** Detectar bots de redes sociales mediante `User-Agent` y responder con `200 OK` y un documento HTML ultraligero con metaetiquetas `og:title`, `og:description`, `og:image`, `og:url` (`https://cristianarando.dev/[slug]`) y `twitter:card`. | P2 | Una petición con `User-Agent: WhatsApp/2.23...` o `Twitterbot/1.0` recibe `200 OK` con las etiquetas Open Graph del enlace en lugar de un `301/307`, sin incrementar el contador de clics humanos. |
| **RF-008** | **Micro-Landing de Proyecto (`type = 'HUB'`):** Cuando el enlace es de tipo `HUB`, renderizar una tarjeta minimalista con la estética de `cristianarando.dev` mostrando título, descripción, categoría y la lista ordenada de botones (`hub_links`: ej. GitHub, Demo, Docs, Video). | P2 | `GET /proyecto-guia-turistica` renderiza la página `HUB` en SSR/ISR ligero; cada clic en un sub-enlace registra telemetría e inicia navegación segura (`rel="noopener noreferrer"`). |
| **RF-009** | **Protección con PIN / Contraseña:** Si el enlace tiene `password_hash`, interceptar el acceso directo (tanto en `DIRECT` como en `HUB`) mostrando un formulario de PIN antes de revelar el destino o los sub-enlaces. | P2 | El HTML inicial y los headers HTTP de un enlace bloqueado jamás contienen `destination_url` ni `hub_links`. Tras enviar el PIN correcto a `POST /api/v1/links/[slug]/unlock`, se autoriza el acceso o redirección. |

### 5.3. Autenticación y Panel de Administración (`/admin`)

| ID | Requerimiento | Fase | Criterio de Aceptación Observable |
| :--- | :--- | :--- | :--- |
| **RF-010** | **Autenticación Exclusiva con GitHub OAuth:** Permitir inicio de sesión únicamente mediante GitHub OAuth validando que el ID numérico de la cuenta de GitHub coincida con `ALLOWED_GITHUB_ID` (y opcionalmente `ALLOWED_GITHUB_EMAIL`). | P1 | Si otro usuario de GitHub intenta autenticarse, el callback de Better-Auth aborta el flujo con error `403 Forbidden`, no crea registro en la tabla `user` ni emite cookie de sesión. |
| **RF-011** | **CRUD Completo de Enlaces:** Crear, leer, editar y eliminar enlaces desde un modal interactivo con validación en tiempo real de disponibilidad de slug (con debounce de `250ms`). | P1 | El formulario impide enviar slugs reservados o duplicados antes del submit y persiste cambios reflejándolos inmediatamente en la lista. |
| **RF-012** | **Layout `100vh` + Infinite Scroll Basado en Cursor:** Mostrar el panel principal ajustado inicialmente al alto de pantalla (`min-h-screen`), cargando un lote inicial de enlaces ($N = 12$) y disparando cargas subsecuentes con `IntersectionObserver` y paginación por cursor compuesto `(is_pinned, id)` mostrando *Skeletons*. | P1 | No se cargan todos los enlaces de golpe; al hacer scroll hasta el centinela inferior se solicita `?cursor=...&limit=12` sin duplicar ni omitir elementos aunque existan enlaces fijados (`is_pinned`). |
| **RF-013** | **Búsqueda en Servidor con Debounce (`300ms`) y Filtros por Categoría:** Buscar enlaces por `slug`, `title`, `description` o `destination_url` directamente en la base de datos tras `300ms` de pausa al escribir, combinable con filtros por categoría (`social`, `project`, `resource`, `personal`, `temporary`) y estado (`active`, `inactive`, `expired`, `pinned`). | P1 | Escribir un término en el buscador encuentra enlaces que aún no habían sido cargados en el cliente por el Infinite Scroll y reinicia el cursor de paginación para los resultados filtrados. |
| **RF-014** | **Acciones Rápidas en Caliente:** Copiar URL corta (`https://cristianarando.dev/[slug]`) con un clic, alternar interruptor `is_active` (pausar/activar), y fijar/desfijar (`is_pinned`) enlaces en la parte superior del panel. | P1 | Cambiar `is_pinned` o `is_active` actualiza el estado de inmediato con feedback visual (toast) y reordena la lista manteniendo la integridad del cursor. |
| **RF-015** | **Selector de Iconos y Auto-Favicon:** Permitir elegir un icono de marca/sistema (Lucide / SimpleIcons, ej. `github`, `linkedin`, `globe`, `file-text`) o resolver un favicon seguro para mostrar en la tarjeta del enlace y en la vista pública. | P1 | Cada enlace muestra su icono representativo en el panel `/admin`, en la micro-landing `HUB` y en `/links`. |
| **RF-016** | **Configuración de Caducidad (`expires_at` y `max_clicks`):** Permitir definir opcionalmente una fecha/hora límite de validez y/o un número máximo de clics permitidos por enlace. | P2 | Al cumplirse cualquiera de las dos condiciones, el enlace deja de redirigir automáticamente sin borrar su historial ni sus métricas. |
| **RF-017** | **Generador y Descargador de Código QR Personalizado:** Generar códigos QR para cualquier enlace corto con los colores de marca y opción de logo central, descargables en formato **SVG** vectorial y **PNG** de alta resolución (`1024x1024px`). | P2 | El modal de QR genera un código escaneable (nivel de corrección de errores `H` cuando incluye logo central) que apunta a `https://cristianarando.dev/[slug]`. |

### 5.4. Directorio Público (`/links`)

| ID | Requerimiento | Fase | Criterio de Aceptación Observable |
| :--- | :--- | :--- | :--- |
| **RF-018** | **Vista Pública de Directorio (`/links`):** Renderizar una página pública estilo *Linktree* avanzado en `cristianarando.dev/links` con perfil del autor, enlaces fijados destacados y cuadrícula/lista de enlaces públicos. | P3 | La página carga sin requerir autenticación y respeta el diseño visual del portafolio. |
| **RF-019** | **Aislamiento Estricto de Enlaces Públicos:** Mostrar en `/links` (y en su API de paginación pública) única y exclusivamente los enlaces que cumplan `is_public = true AND is_active = true` y que no hayan expirado ni alcanzado `max_clicks`. | P3 | Ningún enlace privado (`is_public = false`), inactivo o expirado aparece en el HTML, JSON ni búsquedas de `/links`. |
| **RF-020** | **Pestañas por Categoría e Infinite Scroll en `/links`:** Permitir a los visitantes filtrar `/links` por categoría (`Todos`, `Redes Sociales`, `Proyectos`, `Recursos`) con carga progresiva por cursor e `IntersectionObserver`. | P3 | Cambiar de pestaña filtra los enlaces públicos sin recargar toda la página y soporta Infinite Scroll fluido. |

### 5.5. Analíticas y Telemetría Ligera

| ID | Requerimiento | Fase | Criterio de Aceptación Observable |
| :--- | :--- | :--- | :--- |
| **RF-021** | **Registro Asíncrono No Bloqueante de Clics:** Registrar cada clic válido en segundo plano (`after()` / `waitUntil`) incrementando atómicamente `clicks_count` e insertando una fila en `click_events` sin añadir latencia al redirect del visitante. | P1/P3 | El tiempo de respuesta de `GET /[slug]` no espera el `INSERT` de analíticas; si el registro de telemetría falla, la redirección del usuario igual se completa con éxito. |
| **RF-022** | **Captura de Dimensiones de Tráfico sin PII:** Extraer país (`country`), ciudad (`city` opcional), tipo de dispositivo (`mobile`, `desktop`, `tablet`, `bot`), navegador (`browser`), sistema operativo (`os`) y origen normalizado (`referrer`) a partir de los headers HTTP (`x-vercel-ip-country`, `cf-ipcountry`, `user-agent`, `referer`), sin almacenar direcciones IP en texto plano. | P3 | Las filas en `click_events` contienen metadatos agregables válidos y ninguna dirección IP cruda. |
| **RF-023** | **Panel de Analíticas por Enlace y Global:** Mostrar en `/admin` gráficas de serie temporal (últimos 7 y 30 días), distribución por país, dispositivos/SO y principales referrers (LinkedIn, GitHub, WhatsApp, Directo). | P3 | El administrador puede inspeccionar métricas globales y abrir el detalle estadístico de cualquier enlace individual. |
| **RF-024** | **Integración por Rewrites con `cristianarando.dev`:** Proveer la configuración exacta de Rewrites y verificación de encabezados para que `cristianarando.dev/[slug]` y `cristianarando.dev/links` funcionen de forma transparente coexistiendo con el portafolio. | P3 | Las rutas del portafolio (`/es`, `/en`, `/de`, `/ru`, `/ja`, `/uses`, `/cv`) siguen respondiendo desde el portafolio; cualquier `[slug]` no reservado resuelve desde `inside-link`. |

---

## 6. Requerimientos No Funcionales (RNF)

| ID | Categoría | Especificación y Umbral de Aceptación |
| :--- | :--- | :--- |
| **RNF-001** | **Latencia de Redirección** | P95 $< 50\text{ ms}$ en caliente (Edge/Región cercana a Turso) y P95 $< 150\text{ ms}$ en frío para resoluciones de `GET /[slug]`. |
| **RNF-002** | **Rendimiento del DOM (UX)** | El Dashboard `/admin` y la página `/links` nunca montan más de `24` tarjetas iniciales en el primer renderizado; el scroll infinito mantiene $60\text{ fps}$ sin bloqueo del hilo principal. |
| **RNF-003** | **Seguridad Anti-Open-Redirect y XSS** | Todas las URLs de destino (`destination_url` y `hub_links[].url`) se validan estrictamente con protocolo `http:` o `https:`. Esquemas `javascript:`, `data:`, `vbscript:` o `file:` son rechazados en validación Zod y base de datos. |
| **RNF-004** | **Seguridad de Acceso Admin** | Cero endpoints de mutación o lectura administrativa responden sin sesión válida de Better-Auth vinculada al `ALLOWED_GITHUB_ID`. |
| **RNF-005** | **Protección Fuerza Bruta en PIN** | El endpoint de desbloqueo de enlaces con PIN (`POST /api/v1/links/[slug]/unlock`) aplica *rate limiting* (máx. 5 intentos fallidos por minuto por IP/hash + enlace) y comparación en tiempo constante (`scrypt`/`argon2id` o `bcrypt`). |
| **RNF-006** | **Privacidad y Cumplimiento** | No se almacenan direcciones IP crudas en `click_events`. Para deduplicación o rate-limiting temporal se utiliza un hash truncado con *salt* diario rotativo en memoria/base de datos. |
| **RNF-007** | **Integridad de Datos en SQLite/Turso** | Uso obligatorio de `FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE`, `PRAGMA foreign_keys = ON` y actualizaciones atómicas `clicks_count = clicks_count + 1`. |
| **RNF-008** | **Aislamiento de Assets en Proxy** | Los recursos estáticos de `inside-link` no colisionan con las rutas `/_next` o `/_astro` del portafolio anfitrión en `cristianarando.dev`. |
| **RNF-009** | **SEO y Control de Indexación** | El dominio interno de despliegue (`*.vercel.app`) emite `X-Robots-Tag: noindex, nofollow`. Todas las URLs canónicas y `og:url` apuntan siempre a `https://cristianarando.dev`. |
| **RNF-010** | **Tipado Estricto y Contratos** | TypeScript en modo `strict: true`, `noUncheckedIndexedAccess: true`, validación Zod en todas las entradas de API/Server Actions y cero uso de `any`. |
| **RNF-011** | **Accesibilidad (a11y)** | Componentes interactivos de `/admin`, `/links` y `/[slug]` navegables por teclado, con roles ARIA correctos (vía Radix/shadcn) y contraste mínimo WCAG AA. |
| **RNF-012** | **Verificabilidad y Pruebas** | Cobertura de pruebas automatizadas (Vitest) sobre el motor de rutas reservadas, normalización de slugs, paginación por cursor, resolución de redirección (humano vs bot vs expirado vs PIN) e integración sobre instancia libSQL real de prueba. |
