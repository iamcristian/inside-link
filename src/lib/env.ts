import { z } from "zod";

const serverSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1, "TURSO_DATABASE_URL es requerida"),
  TURSO_AUTH_TOKEN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL debe ser una URL válida").default("http://localhost:3000"),
  GITHUB_CLIENT_ID: z.string().min(1, "GITHUB_CLIENT_ID es requerida"),
  GITHUB_CLIENT_SECRET: z.string().min(1, "GITHUB_CLIENT_SECRET es requerida"),
  ALLOWED_GITHUB_ID: z.string().min(1, "ALLOWED_GITHUB_ID es requerida"),
  ALLOWED_GITHUB_EMAIL: z.string().email().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_CANONICAL_URL: z.string().url("NEXT_PUBLIC_CANONICAL_URL debe ser una URL válida").default("https://cristianarando.dev"),
  NEXT_PUBLIC_ASSET_PREFIX: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function validateEnv(): ServerEnv & ClientEnv {
  const isServer = typeof window === "undefined";

  const clientResult = clientSchema.safeParse({
    NEXT_PUBLIC_CANONICAL_URL: process.env.NEXT_PUBLIC_CANONICAL_URL,
    NEXT_PUBLIC_ASSET_PREFIX: process.env.NEXT_PUBLIC_ASSET_PREFIX,
  });

  if (!clientResult.success) {
    const formatted = clientResult.error.format();
    throw new Error(`[ENV] Variables de entorno cliente inválidas:\n${JSON.stringify(formatted, null, 2)}`);
  }

  if (isServer) {
    const serverResult = serverSchema.safeParse({
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
      ALLOWED_GITHUB_ID: process.env.ALLOWED_GITHUB_ID,
      ALLOWED_GITHUB_EMAIL: process.env.ALLOWED_GITHUB_EMAIL,
      NODE_ENV: process.env.NODE_ENV,
    });

    if (!serverResult.success) {
      const formatted = serverResult.error.format();
      throw new Error(`[ENV] Variables de entorno servidor inválidas:\n${JSON.stringify(formatted, null, 2)}`);
    }

    return { ...serverResult.data, ...clientResult.data };
  }

  // En el cliente, no exponemos las credenciales de servidor
  return {
    ...clientResult.data,
    TURSO_DATABASE_URL: "",
    TURSO_AUTH_TOKEN: undefined,
    BETTER_AUTH_SECRET: "",
    BETTER_AUTH_URL: "",
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    ALLOWED_GITHUB_ID: "",
    ALLOWED_GITHUB_EMAIL: undefined,
    NODE_ENV: "development",
  };
}

export const env = validateEnv();
