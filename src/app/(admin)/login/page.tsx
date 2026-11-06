import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/auth/session";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session?.session && session.user) redirect("/admin/");

  return <LoginForm />;
}
