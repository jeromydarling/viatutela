import { Link } from "react-router";
import type { Route } from "./+types/unsub";
import { getEnv } from "../lib/auth.server";
import { suppress, verifyUnsubToken } from "../../workers/lib/supporter-email";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Unsubscribed — Via Tutela" }, { name: "robots", content: "noindex" }];
}

async function handle(env: Env, token: string) {
  const verified = await verifyUnsubToken(env, token);
  if (!verified) return { ok: false as const };
  await suppress(env, verified.orgId, verified.email);
  const org = await env.DB.prepare(`SELECT name FROM orgs WHERE id = ?`)
    .bind(verified.orgId)
    .first<{ name: string }>();
  return { ok: true as const, orgName: org?.name ?? "the rescue" };
}

export async function loader({ context, params }: Route.LoaderArgs) {
  return handle(getEnv(context), params.token);
}

// RFC 8058 one-click unsubscribe posts here with no body we need to read.
export async function action({ context, params }: Route.ActionArgs) {
  return handle(getEnv(context), params.token);
}

export default function Unsubscribe({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="rounded-blob bg-white shadow-soft p-10 max-w-md text-center">
        {loaderData.ok ? (
          <>
            <div className="text-4xl">🕊️</div>
            <h1 className="mt-3 text-2xl font-display font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-charcoal-soft">
              No more emails from {loaderData.orgName}. Thank you for the time you gave the animals — the door is
              always open if you'd like to come back.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-display font-semibold">That link didn't work</h1>
            <p className="mt-2 text-charcoal-soft">
              It may be old or incomplete. Reply to any email you received and a human will take you off the list.
            </p>
          </>
        )}
        <Link to="/" className="mt-5 inline-block text-sm font-semibold text-meadow-deep hover:underline">
          Via Tutela
        </Link>
      </div>
    </div>
  );
}
