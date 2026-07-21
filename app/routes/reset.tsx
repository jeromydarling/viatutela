import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/reset";
import { marketingMeta } from "../lib/seo";
import { SiteHeader, SiteFooter, Logo } from "../components/site";
import { getEnv } from "../lib/auth.server";
import { sessionCookie } from "../../workers/lib/auth";
import { newToken } from "../../workers/lib/ids";
import { completePasswordReset, resolveResetToken } from "../../workers/lib/password-reset";

export function meta(_: Route.MetaArgs) {
  return [
    ...marketingMeta({
      title: "Choose a new password — Tutela",
      description: "Set a new password for your Tutela account.",
      path: "/reset",
    }),
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const resolved = await resolveResetToken(env, params.token);
  return { valid: Boolean(resolved), email: resolved?.email ?? null };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const env = getEnv(context);
  const f = await request.formData();
  const password = String(f.get("password") ?? "");
  const confirm = String(f.get("confirm") ?? "");
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };
  if (password !== confirm) return { error: "Those two passwords don't match." };

  const origin = new URL(request.url).origin;
  const ok = await completePasswordReset(env, params.token, password, origin);
  if (!ok) {
    return { error: "That reset link has expired or was already used. Request a fresh one." };
  }
  // back to sign-in with their fresh password — proves they know it, and
  // the reset already cleared every old session everywhere
  return redirect("/login?reset=1");
}

const inputCls = "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function Reset({ loaderData, actionData }: Route.ComponentProps) {
  const { valid, email } = loaderData;
  const a = actionData as { error?: string } | undefined;
  const nav = useNavigation();

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-20">
        <div className="rounded-blob bg-white shadow-lift p-8">
          <Logo className="w-16 h-16 mx-auto" />
          {!valid ? (
            <div className="mt-4 text-center">
              <h1 className="text-2xl font-display font-semibold">This link has expired</h1>
              <p className="mt-2 text-charcoal-soft">
                Reset links work once and last an hour. No worries — grab a fresh one.
              </p>
              <Link to="/forgot" className="mt-4 inline-block rounded-full bg-meadow px-6 py-3 font-display font-semibold text-white shadow-soft hover:shadow-lift transition-shadow">
                Send a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mt-2 text-2xl font-display font-semibold text-center">Choose a new password</h1>
              {email && <p className="mt-1 text-center text-sm text-charcoal-soft">for {email}</p>}
              <Form method="post" className="mt-6 space-y-4">
                <label className="block">
                  <span className="font-semibold text-sm">New password (8+ characters)</span>
                  <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">Confirm it</span>
                  <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
                </label>
                {a?.error && <p className="font-semibold text-terracotta-deep" role="alert">{a.error}</p>}
                <button
                  type="submit"
                  disabled={nav.state !== "idle"}
                  className="w-full rounded-full bg-meadow px-6 py-3 font-display font-semibold text-white shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
                >
                  {nav.state !== "idle" ? "Saving…" : "Set my new password"}
                </button>
              </Form>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
