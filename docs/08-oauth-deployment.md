# OAuth detrás del dominio público

## Origen y login de GitHub

En producción, `BETTER_AUTH_URL` debe ser `https://www.cristianarando.dev`.
En la OAuth App de GitHub, configurar **Redirect URI** exactamente como
`https://www.cristianarando.dev/api/auth/callback/github`.
Cambiar el origen de Better Auth exige actualizar este callback en el mismo despliegue.
No activar wildcards ni cambiar el secreto para solucionar una discrepancia de URL.

El 6 de noviembre de 2026 se corrigió el callback que aún apuntaba al dominio sin
`www`. Se verificó un login real desde `/login/` hasta `/admin/`.

## Endpoints MCP y redirecciones

El portfolio usa `trailingSlash: true`. Vercel redirige los paths sin extensión
antes de aplicar el proxy. Con `Accept: application/json`, la respuesta puede ser
`308 {"redirect":"/api/auth/oauth2/token/","status":"308"}`. Codex interpreta
esa respuesta como un token y falla con `missing field access_token`.

La metadata de autorización publica `/api/auth/oauth2/token.json`. El handler
resuelve este alias internamente al endpoint de Better Auth, sin redirección HTTP.
Se conservan PKCE, validación del cliente, límite de 16 KiB y transacciones de
emisión/rotación. Las URLs anteriores siguen disponibles para clientes existentes.
JWKS usa `/api/auth/jwks.json` por el mismo motivo. Esto sigue la excepción para
paths con extensión documentada por [Vercel](https://vercel.com/docs/project-configuration/vercel-json#trailingslash).

La ruta `.json` es una API dinámica, no un archivo público de tokens. No requiere
otra base de datos, migraciones, nuevas variables ni cambios al proxy del portfolio.

## Verificación después de desplegar

1. Consultar `https://www.cristianarando.dev/.well-known/oauth-authorization-server/api/auth/`.
   Verificar el issuer `https://www.cristianarando.dev/api/auth` y el endpoint
   `https://www.cristianarando.dev/api/auth/oauth2/token.json`.
2. Hacer un POST al endpoint publicado con `Content-Type: application/x-www-form-urlencoded`,
   `Accept: application/json` y body `grant_type=invalid_probe`, sin seguir redirects.
   Debe devolver **400**, `error: unsupported_grant_type`, sin `Location`.
   Un 308 señala un fallo de routing; un 200 no constituye un intercambio válido.
3. Ejecutar `codex mcp login insidelink` y verificar que la CLI confirme el login.
   La página local «Authentication complete» puede aparecer antes del canje de tokens;
   no basta como prueba. Comprobar el estado con `codex mcp list`.
4. Consultar `tools/list` y ejecutar `list_links` con límite 2 desde el cliente.
   Repetir una lectura después de la expiración del access token (600 segundos)
   para verificar el refresh. No guardar ni imprimir tokens en logs o capturas.
5. Si un cliente anterior no recibió refresh token, reconectarlo solicitando
   `offline_access`; no ampliar silenciosamente los scopes de una concesión.

La prueba automatizada `mcp-oauth-probe.test.ts` simula el 308 del portfolio y
usa el endpoint anunciado para canje, PKCE, lectura, refresh y revocación. La
verificación del dominio público y del cliente real sigue siendo necesaria tras
el despliegue.
