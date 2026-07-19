import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { getEnv } from "../lib/auth.server";
import { AUTH_COOKIE, clearSessionCookie } from "../../workers/lib/auth";

export async function action({ context, request }: Route.ActionArgs) {
  const env = getEnv(context);
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${AUTH_COOKIE}=([a-f0-9]{48})`));
  if (match) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(match[1]).run();
  }
  return redirect("/", { headers: { "Set-Cookie": clearSessionCookie() } });
}

export async function loader() {
  return redirect("/");
}
