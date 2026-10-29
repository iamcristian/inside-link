# Decisiones de Arquitectura — Congelamiento de Versiones del Stack

> **Registro:** `docs/decisions/stack-versions.md`  
> **Fecha:** 2026-10-27  
> **Estado:** Aprobado y congelado en `package.json` y `pnpm-lock.yaml`.

---

## 1. Versiones Principales Congeladas

| Componente | Versión Exacta | Justificación |
| :--- | :--- | :--- |
| **Node.js** | `v24.11.1` LTS | Soporte nativo de ESM, `node:crypto` con `scrypt` y compatibilidad Next.js 16. |
| **pnpm** | `12.11.2` | Gestor determinista con `allowBuilds: esbuild: true`. |
| **Next.js** | `16.4.3` (App Router) | Soporte nativo de `after()`, Route Handlers ultrarrápidos y Server Components. |
| **React** | `19.3.0` | Versión oficial alineada con Next.js 16. |
| **libSQL Client** | `0.15.15` (`@libsql/client`) | Driver oficial de Turso para SQLite distribuido vía HTTP/WebSockets y `file:local.db`. |
| **Drizzle ORM** | `0.45.4` (`drizzle-orm`) | ORM sin compilador pesado, consultas SQL transparentes y soporte `sqlite-core`. |
| **Drizzle Kit** | `0.31.11` (`drizzle-kit`) | Generación y ejecución de migraciones DDL. |
| **Better-Auth** | `1.7.13` | Autenticación ligera con adaptador Drizzle y bloqueo por `ALLOWED_GITHUB_ID`. |
| **Zod** | `3.25.76` | Validación de contratos de entrada y variables de entorno. |
| **ulidx** | `2.4.1` | Generador de ULIDs de 26 caracteres ordenables por tiempo. |
| **Tailwind CSS** | `4.3.3` | Motor de estilos moderno y compilación rápida con `@tailwindcss/postcss`. |
| **Vitest** | `3.2.7` | Ejecución de pruebas unitarias y de integración rápida en Node. |
| **TypeScript** | `5.9.3` | Compilador estricto (`strict: true`, `noUncheckedIndexedAccess: true`). |
