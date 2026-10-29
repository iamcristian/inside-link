import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db as defaultDb } from "../db";
import * as schema from "../db/schema";
import { env } from "@/lib/env";

export function createAuthInstance(database: any = defaultDb) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [
      "https://cristianarando.dev",
      "https://www.cristianarando.dev",
      "https://inside-link.vercel.app",
      "http://localhost:3000",
    ],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => {
            if (account.providerId === "github") {
              const allowedGithubId = process.env.ALLOWED_GITHUB_ID || env.ALLOWED_GITHUB_ID;
              if (account.accountId !== allowedGithubId) {
                throw new APIError("FORBIDDEN", {
                  message: "Acceso restringido exclusivamente al propietario del dominio.",
                });
              }
            }
          },
        },
      },
      user: {
        create: {
          before: async (user) => {
            const allowedEmail = process.env.ALLOWED_GITHUB_EMAIL || env.ALLOWED_GITHUB_EMAIL;
            if (allowedEmail && user.email.toLowerCase() !== allowedEmail.toLowerCase()) {
              throw new APIError("FORBIDDEN", {
                message: "Acceso restringido: el correo no coincide con el del propietario.",
              });
            }
          },
        },
      },
    },
  });
}

export const auth = createAuthInstance();
