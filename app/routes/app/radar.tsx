import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/radar";
import { requireUser } from "../../lib/auth.server";
import { aiAvailable } from "../../../workers/lib/ai-flags";
import { draftRadarReply } from "../../../workers/lib/radar";
import { logAiWrite } from "../../../workers/lib/ai";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Adopter Radar — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const [posts, org] = await Promise.all([
    env.DB.prepare(
      `SELECT id, source, author, text, url, posted_at, fetched_at FROM radar_posts
       ORDER BY coalesce(posted_at, fetched_at) DESC LIMIT 200`,
    ).all<Record<string, string | null>>(),
    env.DB.prepare(`SELECT name, slug, state, address FROM orgs WHERE id = ?`)
      .bind(user.org_id)
      .first<{ name: string; slug: string; state: string | null; address: string | null }>(),
  ]);
  return {
    posts: posts.results,
    orgState: org?.state ?? null,
    aiReady: aiAvailable(env),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const f = await request.formData();
  if (String(f.get("intent")) !== "draft-reply") return null;
  const postId = String(f.get("post_id"));
  const post = await env.DB.prepare(`SELECT text FROM radar_posts WHERE id = ?`)
    .bind(postId)
    .first<{ text: string }>();
  if (!post) return { error: "That post has aged out of the radar." };
  const org = await env.DB.prepare(`SELECT name, slug FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ name: string; slug: string }>();
  const res = await draftRadarReply(env, {
    orgId: user.org_id,
    postText: post.text,
    orgName: org?.name ?? "our rescue",
    orgSlug: org?.slug ?? "",
    origin: new URL(request.url).origin,
  });
  if (res.error || !res.reply) return { error: res.error ?? "No draft came back.", postId };
  ctx.waitUntil(logAiWrite(env, user.org_id, user.user_id, "radar_reply", post.text.slice(0, 80)));
  return { reply: res.reply, postId };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const h = Math.floor(ms / 3_600_000);
  if (!isFinite(h) || h < 0) return "";
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Radar({ loaderData, actionData }: Route.ComponentProps) {
  const { posts, orgState, aiReady } = loaderData;
  const a = actionData as { reply?: string; error?: string; postId?: string } | undefined;
  const nav = useNavigation();
  const [filter, setFilter] = useState("");

  const shown = filter.trim()
    ? posts.filter((p) =>
        filter
          .toLowerCase()
          .split(/[,\s]+/)
          .filter(Boolean)
          .some((t) => `${p.text} ${p.author}`.toLowerCase().includes(t)),
      )
    : posts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Adopter Radar 📡</h1>
        <p className="text-sm text-charcoal-soft max-w-2xl">
          Real people on Bluesky and Reddit saying they want to adopt, refreshed every few hours from
          public posts. If one sounds nearby, reply <em>as yourself</em> from your own account — a warm
          note from a real rescue person is the best marketing that exists. Tutela never auto-replies or
          messages anyone.
        </p>
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter by words… try your city${orgState ? ` or "${orgState}"` : ""}, "senior", "first time"`}
        className="w-full max-w-xl rounded-xl border-2 border-cream bg-white px-4 py-2 focus:border-meadow outline-none"
      />

      {shown.length === 0 ? (
        <div className="rounded-blob bg-white shadow-soft p-10 text-center text-charcoal-soft">
          {posts.length === 0
            ? "The radar sweeps every six hours — the first posts will appear after the next sweep."
            : "Nothing matches that filter right now. The radar refreshes every few hours."}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {shown.map((p) => (
            <div key={String(p.id)} className="rounded-blob bg-white shadow-soft p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-charcoal-soft">
                <span className={`rounded-full px-2 py-0.5 ${p.source === "bluesky" ? "bg-sky/20 text-sky-deep" : "bg-terracotta/15 text-terracotta-deep"}`}>
                  {p.source}
                </span>
                <span className="truncate">{p.author}</span>
                <span className="ml-auto shrink-0">{timeAgo(p.posted_at ?? p.fetched_at)}</span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{p.text}</p>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <a href={String(p.url)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-meadow-deep hover:underline">
                  Open post ↗
                </a>
                {aiReady && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="draft-reply" />
                    <input type="hidden" name="post_id" value={String(p.id)} />
                    <button disabled={nav.state !== "idle"} className="text-sm font-semibold text-charcoal-soft hover:text-charcoal disabled:opacity-50">
                      ✨ Draft a warm reply
                    </button>
                  </Form>
                )}
              </div>
              {a?.postId === p.id && a.reply && (
                <div className="mt-3 rounded-2xl bg-meadow/10 p-3">
                  <p className="text-sm">{a.reply}</p>
                  <p className="mt-1.5 text-xs text-charcoal-soft">
                    Copy it, tweak it so it sounds like you, and post it from your own account.
                  </p>
                </div>
              )}
              {a?.postId === p.id && a.error && (
                <p className="mt-2 text-sm font-semibold text-terracotta-deep">{a.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
