import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/auth/session";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session?.session && session.user) redirect("/admin/");

  return <LoginForm />;
}
