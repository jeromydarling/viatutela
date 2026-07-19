import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/signup";
import { marketingMeta } from "../lib/seo";
import { getEnv } from "../lib/auth.server";
import { SiteHeader } from "../components/site";
import { Logo } from "../components/site";
import { newId, newToken } from "../../workers/lib/ids";
import { hashPassword } from "../../workers/lib/password";
import { sessionCookie } from "../../workers/lib/auth";
import { seedNewOrg } from "../../workers/lib/onboarding";
import { cloudflareContext } from "../cloudflare-context";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "Get started — Via Tutela",
    description: "Set up your shelter on Via Tutela in minutes — $9 a month plus $1 per adoption, importer included.",
    path: "/signup",
  });
}

export async function action({ context, request }: Route.ActionArgs) {
  const env = getEnv(context);
  const { ctx } = context.get(cloudflareContext);
  const f = await request.formData();
  if (String(f.get("website") ?? "")) return { error: "Something went wrong." }; // honeypot

  const orgName = String(f.get("org_name") ?? "").trim();
  const name = String(f.get("name") ?? "").trim();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");

  if (!orgName) return { error: "What's your rescue called?" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
  if (existing) {
    return { error: "That email already has an account — sign in instead (or reset via your team)." };
  }

  const slugBase =
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "rescue";
  const slug = `${slugBase}-${newId("x").slice(2, 8)}`;
  const orgId = newId("org");
  const userId = newId("u");
  const { hash, salt } = await hashPassword(password);
  const token = newToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO orgs (id, slug, name, plan) VALUES (?, ?, ?, 'starter')`).bind(orgId, slug, orgName.slice(0, 120)),
    env.DB.prepare(
      `INSERT INTO users (id, org_id, email, name, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(userId, orgId, email, name.slice(0, 120) || null, hash, salt),
    env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).bind(token, userId, expires),
  ]);

  // the nest is never empty: starter site drafts, a to-do list, the drip
  ctx.waitUntil(seedNewOrg(env, { orgId, orgName, slug, email, name: name || null }));

  return redirect("/app", { headers: { "Set-Cookie": sessionCookie(token) } });
}

const inputCls =
  "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function Signup() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-blob bg-white shadow-lift p-8">
          <Logo className="w-16 h-16 mx-auto" />
          <h1 className="mt-2 text-3xl font-display font-semibold text-center">Get started</h1>
          <p className="mt-1 text-center text-sm text-charcoal-soft">
            Two minutes to a working shelter platform. Free to move in — Starter is $9 a month
            plus $1 for every animal you send home.
          </p>
          <Form method="post" className="mt-6 space-y-4">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <label className="block">
              <span className="font-semibold text-sm">Your rescue's name *</span>
              <input name="org_name" required maxLength={120} placeholder="Sunny Meadow Rescue" className={inputCls} />
            </label>
            <label className="block">
              <span className="font-semibold text-sm">Your name</span>
              <input name="name" maxLength={120} className={inputCls} />
            </label>
            <label className="block">
              <span className="font-semibold text-sm">Email *</span>
              <input name="email" type="email" required className={inputCls} />
            </label>
            <label className="block">
              <span className="font-semibold text-sm">Password * <span className="font-normal text-xs text-charcoal-soft">(8+ characters)</span></span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
            </label>
            {actionData?.error && (
              <p className="font-semibold text-terracotta-deep" role="alert">{actionData.error}</p>
            )}
            <button
              type="submit"
              disabled={nav.state !== "idle"}
              className="w-full rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-lg shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
            >
              {nav.state !== "idle" ? "Setting up your nest…" : "Create my rescue's account"}
            </button>
          </Form>
          <p className="mt-4 text-center text-sm text-charcoal-soft">
            Coming from another system?{" "}
            <Link to="/import" className="font-semibold text-meadow-deep hover:underline">
              The free importer
            </Link>{" "}
            brings every record and relationship with you.
          </p>
          <p className="mt-2 text-center text-sm text-charcoal-soft">
            Already nested? <Link to="/login" className="font-semibold text-meadow-deep hover:underline">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
