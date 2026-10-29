import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./config";

function isLocalDevPreviewBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (!process.env.GITHUB_CLIENT_ID ||
      process.env.GITHUB_CLIENT_ID === "dummy_client_id" ||
      process.env.GITHUB_CLIENT_ID === "dev_github_client_id")
  );
}

export async function getAdminSession(customHeaders?: Headers) {
  const reqHeaders = customHeaders || (await headers());
  try {
    const sessionData = await auth.api.getSession({
      headers: reqHeaders,
    });
    if (sessionData?.session && sessionData?.user) {
      return sessionData;
    }
  } catch {
    // Ignorar error de lectura de sesión
  }

  // En desarrollo local antes de configurar credenciales reales de GitHub OAuth,
  // habilitamos una sesión de vista previa local para poder inspeccionar /admin.
  if (isLocalDevPreviewBypassEnabled()) {
    const now = new Date();
    return {
      session: {
        id: "local-dev-preview-session",
        userId: "local-dev-owner",
        token: "local-dev-token",
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 86_400_000),
      },
      user: {
        id: "local-dev-owner",
        name: "Cristian Arando (Local Preview)",
        email: "cristian@cristianarando.dev",
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  return null;
}

export async function requireAdminSession(customHeaders?: Headers) {
  const sessionData = await getAdminSession(customHeaders);
  if (!sessionData?.session || !sessionData?.user) {
    redirect("/login");
  }
  return sessionData;
}

export async function assertAdminApiSession(reqHeaders: Headers) {
  const sessionData = await getAdminSession(reqHeaders);
  if (!sessionData?.session || !sessionData?.user) {
    return {
      authorized: false as const,
      response: Response.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Acceso no autorizado: Se requiere sesión de administrador.",
          },
        },
        { status: 401 }
      ),
    };
  }
  return { authorized: true as const, session: sessionData };
}
