import { Form, Link, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/forgot";
import { marketingMeta } from "../lib/seo";
import { SiteHeader, SiteFooter, Logo } from "../components/site";
import { getEnv } from "../lib/auth.server";
import { loginAllowed, recordFailedLogin } from "../../workers/lib/auth";
import { requestPasswordReset } from "../../workers/lib/password-reset";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "Reset your password — Tutela",
    description: "Forgot your Tutela password? We'll email you a secure link to set a new one.",
    path: "/forgot",
  });
}

export async function action({ context, request }: Route.ActionArgs) {
  const env = getEnv(context);
  const f = await request.formData();
  const email = String(f.get("email") ?? "").trim().toLowerCase();

  // reuse the login limiter so this can't be turned into an email cannon
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (await loginAllowed(env, ip, `reset:${email}`)) {
    await requestPasswordReset(env, email, new URL(request.url).origin);
    await recordFailedLogin(env, ip, `reset:${email}`);
  }
  // always the same answer — never reveal whether an account exists
  return { sent: true };
}

const inputCls = "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function Forgot() {
  const a = useActionData<typeof action>();
  const nav = useNavigation();
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-20">
        <div className="rounded-blob bg-white shadow-lift p-8">
          <Logo className="w-16 h-16 mx-auto" />
          <h1 className="mt-2 text-2xl font-display font-semibold text-center">Reset your password</h1>
          {a?.sent ? (
            <div className="mt-6 text-center">
              <p className="text-4xl">📬</p>
              <p className="mt-3 text-charcoal-soft">
                If that email has an account, a reset link is on its way. It works once and expires in an hour —
                check your spam folder if it's shy.
              </p>
              <Link to="/login" className="mt-4 inline-block font-semibold text-meadow-deep hover:underline">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-center text-sm text-charcoal-soft">
                Enter your email and we'll send you a secure link to choose a new one.
              </p>
              <Form method="post" className="mt-6 space-y-4">
                <label className="block">
                  <span className="font-semibold text-sm">Email</span>
                  <input name="email" type="email" required autoComplete="email" className={inputCls} />
                </label>
                <button
                  type="submit"
                  disabled={nav.state !== "idle"}
                  className="w-full rounded-full bg-meadow px-6 py-3 font-display font-semibold text-white shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
                >
                  {nav.state !== "idle" ? "Sending…" : "Email me a reset link"}
                </button>
              </Form>
              <p className="mt-4 text-center text-sm text-charcoal-soft">
                Remembered it?{" "}
                <Link to="/login" className="font-semibold text-meadow-deep hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
