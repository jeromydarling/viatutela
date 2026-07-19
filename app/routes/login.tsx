import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { SiteHeader, SiteFooter, Logo } from "../components/site";
import { getEnv } from "../lib/auth.server";
import { getAuthedUser, sessionCookie } from "../../workers/lib/auth";
import { verifyPassword } from "../../workers/lib/password";
import { newToken } from "../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sign in — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const env = getEnv(context);
  const user = await getAuthedUser(env, request);
  if (user) throw redirect("/app");
  return null;
}

export async function action({ context, request }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Email and password, please." };

  const user = await env.DB.prepare(
    `SELECT id, password_hash, password_salt FROM users WHERE email = ?`,
  )
    .bind(email)
    .first<{ id: string; password_hash: string | null; password_salt: string | null }>();

  if (!user || !user.password_hash || !user.password_salt) {
    return { error: "We don't recognize that email and password together." };
  }
  const ok = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!ok) return { error: "We don't recognize that email and password together." };

  const token = newToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(token, user.id, expires)
    .run();

  return redirect("/app", { headers: { "Set-Cookie": sessionCookie(token) } });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-20">
        <div className="rounded-blob bg-white shadow-lift p-8">
          <Logo className="w-16 h-16 mx-auto" />
          <h1 className="mt-2 text-3xl font-display font-semibold text-center">Welcome back</h1>
          <Form method="post" className="mt-6 space-y-4">
            <label className="block">
              <span className="font-semibold text-sm">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
              />
            </label>
            <label className="block">
              <span className="font-semibold text-sm">Password</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
              />
            </label>
            {actionData?.error && (
              <p className="font-semibold text-terracotta-deep" role="alert">
                {actionData.error}
              </p>
            )}
            <button
              type="submit"
              disabled={nav.state !== "idle"}
              className="w-full rounded-full bg-meadow px-6 py-3 font-display font-semibold text-white shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
            >
              {nav.state !== "idle" ? "Opening the door…" : "Sign in"}
            </button>
          </Form>
          <p className="mt-4 text-center text-sm text-charcoal-soft">
            New here?{" "}
            <Link to="/import" className="font-semibold text-meadow-deep hover:underline">
              Start with a free import
            </Link>{" "}
            — your account is created when you keep the data.
          </p>
          <div className="mt-4 border-t border-cream pt-4 text-center">
            <a
              href="/demo"
              className="inline-block rounded-full bg-sunflower px-5 py-2.5 text-sm font-display font-semibold shadow-soft hover:shadow-lift transition-shadow"
            >
              🌻 Or take the demo shelter for a spin
            </a>
            <p className="mt-1.5 text-xs text-charcoal-soft">No signup — a full rescue with real-feeling data, reset every 6 hours.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
