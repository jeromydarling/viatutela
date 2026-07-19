import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/join";
import { SiteHeader, SiteFooter, Logo } from "../components/site";
import { getEnv } from "../lib/auth.server";
import { sessionCookie } from "../../workers/lib/auth";
import { hashPassword } from "../../workers/lib/password";
import { newToken } from "../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Join your team — Tutela" }];
}

async function findInvite(env: Env, token: string) {
  if (!/^[a-f0-9]{24,64}$/.test(token)) return null;
  return env.DB.prepare(
    `SELECT u.id, u.email, u.name, o.name org_name FROM users u JOIN orgs o ON o.id = u.org_id
     WHERE u.invite_token = ? AND u.password_hash IS NULL`,
  )
    .bind(token)
    .first<{ id: string; email: string; name: string | null; org_name: string }>();
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const invite = await findInvite(env, params.token);
  return { invite: invite ? { email: invite.email, name: invite.name, orgName: invite.org_name } : null };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const env = getEnv(context);
  const invite = await findInvite(env, params.token);
  if (!invite) return { error: "This invite link isn't valid anymore — ask your teammate for a fresh one." };

  const f = await request.formData();
  const name = String(f.get("name") ?? "").trim() || invite.name;
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return { error: "Pick a password of at least 8 characters." };

  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare(
    `UPDATE users SET name = ?, password_hash = ?, password_salt = ?, invite_token = NULL WHERE id = ?`,
  )
    .bind(name, hash, salt, invite.id)
    .run();

  const token = newToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(token, invite.id, expires)
    .run();
  return redirect("/app", { headers: { "Set-Cookie": sessionCookie(token) } });
}

export default function Join({ loaderData, actionData }: Route.ComponentProps) {
  const { invite } = loaderData;
  const nav = useNavigation();
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-20">
        <div className="rounded-blob bg-white shadow-lift p-8">
          <Logo className="w-16 h-16 mx-auto" />
          {invite ? (
            <>
              <h1 className="mt-2 text-3xl font-display font-semibold text-center">
                Welcome to {invite.orgName}
              </h1>
              <p className="mt-2 text-center text-charcoal-soft">
                Set a password for <strong>{invite.email}</strong> and you're in.
              </p>
              <Form method="post" className="mt-6 space-y-4">
                <label className="block">
                  <span className="font-semibold text-sm">Your name</span>
                  <input
                    name="name"
                    defaultValue={invite.name ?? ""}
                    autoComplete="name"
                    className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-sm">Password (8+ characters)</span>
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none"
                  />
                </label>
                {actionData?.error && (
                  <p className="font-semibold text-terracotta-deep" role="alert">{actionData.error}</p>
                )}
                <button
                  type="submit"
                  disabled={nav.state !== "idle"}
                  className="w-full rounded-full bg-meadow px-6 py-3 font-display font-semibold text-white shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
                >
                  {nav.state !== "idle" ? "Opening the door…" : "Join the team"}
                </button>
              </Form>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-2xl font-display font-semibold text-center">
                This invite has wandered off
              </h1>
              <p className="mt-3 text-center text-charcoal-soft">
                The link is invalid, already used, or was withdrawn. Ask your teammate to send a
                fresh one from Settings → Your team.
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
