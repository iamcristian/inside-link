export const RESERVED_SLUGS = new Set([
  // 1. Rutas del propio sistema InsideLink
  "admin",
  "dashboard",
  "login",
  "logout",
  "signin",
  "signout",
  "api",
  "auth",
  "links",
  "hub",
  "unlock",
  "qr",
  "analytics",
  "settings",
  // 2. Rutas técnicas, framework Next.js y archivos raíz
  "_next",
  "_il",
  "_vercel",
  "assets",
  "public",
  "static",
  "images",
  "fonts",
  "og",
  "favicon",
  "robots",
  "sitemap",
  "manifest",
  "404",
  "500",
  "error",
  "health",
  "ping",
]);

export const FORBIDDEN_FILE_EXTENSIONS = new Set([
  "ico",
  "xml",
  "txt",
  "json",
  "webmanifest",
  "png",
  "jpg",
  "jpeg",
  "svg",
  "webp",
  "gif",
  "js",
  "mjs",
  "css",
  "map",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "pdf",
  "html",
  "htm",
  "php",
  "asp",
]);

export function isReservedSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();

  // Si contiene un punto, verificar si tiene extensión de archivo
  if (normalized.includes(".")) {
    const ext = normalized.split(".").pop();
    if (ext && FORBIDDEN_FILE_EXTENSIONS.has(ext)) {
      return true;
    }
  }

  // Comprobar si está en la lista de slugs reservados del sistema InsideLink
  if (RESERVED_SLUGS.has(normalized)) {
    return true;
  }

  return false;
}
