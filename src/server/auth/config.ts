import { betterAuth, APIError } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { db as defaultDb, type AuthDatabase } from "../db";
import * as schema from "../db/schema";
import { env } from "@/lib/env";
import {
  createOwnerCheck,
  getMcpConsents,
  getMcpResource,
  MCP_ANALYTICS_SCOPE,
  MCP_GRANTS_CLAIM,
  MCP_JWKS_PATH,
  MCP_READ_SCOPE,
} from "./mcp-policy";

export function createAuthInstance(
  database: AuthDatabase = defaultDb,
  resource = getMcpResource(),
) {
  const isOwner = createOwnerCheck(database);
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    disabledPaths: resource ? ["/token", "/oauth2/delete-consent"] : [],
    plugins: resource
      ? [
          jwt({
            disableSettingJwtHeader: true,
            jwks: { jwksPath: MCP_JWKS_PATH },
          }),
          mcp({
            resource,
            loginPage: "/login/",
            consentPage: "/admin/integrations/consent/",
            scopes: [MCP_READ_SCOPE, MCP_ANALYTICS_SCOPE, "offline_access"],
            grantTypes: ["authorization_code", "refresh_token"],
            accessTokenExpiresIn: 600,
            refreshTokenReuseInterval: 0,
            clientPrivileges: () => false,
            resourcePrivileges: () => false,
            customAccessTokenClaims: async ({ user, resources }) => {
              if (
                !user ||
                !resources?.includes(resource) ||
                !(await isOwner(user.id))
              ) {
                throw new APIError("FORBIDDEN");
              }
              const grants = await getMcpConsents(database, user.id, resource);
              if (grants.length === 0) throw new APIError("FORBIDDEN");
              return { [MCP_GRANTS_CLAIM]: grants.map(({ id }) => id) };
            },
          }),
          cimd({
            fetchClientMetadataResource,
            metadataProfile: "mcp-2026-07-28",
          }),
        ]
      : [],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          !resource ||
          ![
            "/oauth2/authorize",
            "/oauth2/consent",
            "/oauth2/continue",
          ].includes(ctx.path)
        )
          return;
        const session = await getSessionFromCtx(ctx);
        if (session && !(await isOwner(session.user.id)))
          throw new APIError("FORBIDDEN");
      }),
    },
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
              const allowedGithubId =
                process.env.ALLOWED_GITHUB_ID || env.ALLOWED_GITHUB_ID;
              if (account.accountId !== allowedGithubId) {
                throw new APIError("FORBIDDEN", {
                  message:
                    "Acceso restringido exclusivamente al propietario del dominio.",
                });
              }
            }
          },
        },
      },
      user: {
        create: {
          before: async (user) => {
            const allowedEmail =
              process.env.ALLOWED_GITHUB_EMAIL || env.ALLOWED_GITHUB_EMAIL;
            if (
              allowedEmail &&
              user.email.toLowerCase() !== allowedEmail.toLowerCase()
            ) {
              throw new APIError("FORBIDDEN", {
                message:
                  "Acceso restringido: el correo no coincide con el del propietario.",
              });
            }
          },
        },
      },
    },
  });
}

export const auth = createAuthInstance();
