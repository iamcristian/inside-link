export const RESERVED_SLUGS = new Set([
  // 1. Rutas de idiomas del portafolio (i18n)
  "es", "en", "de", "ru", "ja", "fr", "pt", "it", "zh", "ko", "ar", "hi",
  // 2. Rutas estáticas y secciones del portafolio (incluyendo páginas reales de my-portfolio)
  "uses", "cv", "resume", "projects", "proyectos", "blog", "posts",
  "bookshelf", "library", "search", "series", "search-index", "news-sitemap", "rss",
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

export const FORBIDDEN_FILE_EXTENSIONS = new Set([
  "ico", "xml", "txt", "json", "webmanifest", "png", "jpg", "jpeg",
  "svg", "webp", "gif", "js", "mjs", "css", "map", "woff", "woff2",
  "ttf", "eot", "pdf", "html", "htm", "php", "asp"
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

  // Comprobar si está en la lista de slugs reservados exactos
  if (RESERVED_SLUGS.has(normalized)) {
    return true;
  }

  // Bloquear cualquier código de idioma ISO 639-1 de 2 letras
  if (normalized.length === 2 && /^[a-z]{2}$/.test(normalized)) {
    return true;
  }

  return false;
}
