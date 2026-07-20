import { Link } from "react-router";
import type { Route } from "./+types/find.unsub";
import { getEnv } from "../lib/auth.server";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Alert removed — Tutela" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  if (/^[a-f0-9]{48}$/.test(params.token)) {
    await env.DB.prepare(`DELETE FROM adopt_alerts WHERE token = ?`).bind(params.token).run();
  }
  return { ok: true };
}

export default function FindUnsub() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="rounded-blob bg-white shadow-soft p-8 text-center max-w-md">
        <p className="text-3xl">🐾</p>
        <h1 className="mt-2 text-xl font-display font-semibold">Your alert is off</h1>
        <p className="mt-2 text-charcoal-soft">
          No more emails from this alert. If a friend found you already — that's the best reason there is.
        </p>
        <Link to="/find" className="mt-4 inline-block font-semibold text-meadow-deep hover:underline">
          Browse friends again →
        </Link>
      </div>
    </div>
  );
}
