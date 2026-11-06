import { beforeEach, expect, it, vi } from "vitest";

const { getSession, requestHeaders } = vi.hoisted(() => ({
  getSession: vi.fn(),
  requestHeaders: new Headers({ cookie: "session=browser-session" }),
}));

vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("@/server/auth/config", () => ({
  auth: { api: { getSession } },
}));
vi.mock("@/app/(admin)/login/login-form", () => ({
  default: function LoginForm() {
    return null;
  },
}));

import LoginPage from "@/app/(admin)/login/page";
import LoginForm from "@/app/(admin)/login/login-form";

beforeEach(() => getSession.mockReset());

it("redirects an authenticated visitor from login to the admin panel", async () => {
  getSession.mockResolvedValue({
    session: { id: "active-session" },
    user: { id: "owner" },
  });

  await expect(LoginPage()).rejects.toMatchObject({
    digest: "NEXT_REDIRECT;replace;/admin/;307;",
  });
  expect(getSession).toHaveBeenCalledWith({ headers: requestHeaders });
});

it("shows GitHub login when the session is absent or expired", async () => {
  getSession.mockResolvedValue(null);

  expect((await LoginPage()).type).toBe(LoginForm);
});
