import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/radar";
import { requireUser } from "../../lib/auth.server";
import { aiAvailable } from "../../../workers/lib/ai-flags";
import { draftRadarReply } from "../../../workers/lib/radar";
import { logAiWrite } from "../../../workers/lib/ai";
import { newId } from "../../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Adopter Radar — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = await env.DB.prepare(`SELECT name, slug, state, address, radar_enabled FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ name: string; slug: string; state: string | null; address: string | null; radar_enabled: number }>();

  if (!org?.radar_enabled) {
    return { enabled: false, posts: [], orgState: null, aiReady: false, pileup: {} as Record<string, number> };
  }

  const [posts, pileup] = await Promise.all([
    env.DB.prepare(
      `SELECT id, source, author, text, url, posted_at, fetched_at FROM radar_posts
       ORDER BY coalesce(posted_at, fetched_at) DESC LIMIT 200`,
    ).all<Record<string, string | null>>(),
    // how many OTHER shelters have already replied to each post — shown
    // plainly so a shelter can choose to skip a post that's had plenty of
    // outreach already, rather than piling on a stranger unknowingly
    env.DB.prepare(
      `SELECT post_id, COUNT(*) n FROM radar_replies WHERE org_id != ? GROUP BY post_id`,
    )
      .bind(user.org_id)
      .all<{ post_id: string; n: number }>(),
  ]);
  return {
    enabled: true,
    posts: posts.results,
    orgState: org.state ?? null,
    aiReady: aiAvailable(env),
    pileup: Object.fromEntries(pileup.results.map((r) => [r.post_id, r.n])),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));

  if (intent === "toggle-enabled") {
    const next = f.get("next") === "1" ? 1 : 0;
    await env.DB.prepare(`UPDATE orgs SET radar_enabled = ? WHERE id = ?`).bind(next, user.org_id).run();
    return { toggled: true };
  }

  if (intent !== "draft-reply") return null;
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
  ctx.waitUntil(
    env.DB.prepare(`INSERT OR IGNORE INTO radar_replies (id, post_id, org_id) VALUES (?, ?, ?)`)
      .bind(newId("rr"), postId, user.org_id)
      .run(),
  );
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
  const { enabled, posts, orgState, aiReady, pileup } = loaderData;
  const a = actionData as { reply?: string; error?: string; postId?: string } | undefined;
  const nav = useNavigation();
  const [filter, setFilter] = useState("");

  if (!enabled) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-display font-semibold">Adopter Radar 📡</h1>
        <div className="rounded-blob bg-white shadow-soft p-6 space-y-3">
          <p className="text-charcoal-soft">
            Real people on Bluesky and Reddit saying they want to adopt, refreshed every few hours from
            public posts. Turn it on and, if one sounds nearby, reply <em>as yourself</em> from your own
            account — a warm note from a real rescue person is the best marketing that exists.
          </p>
          <p className="text-sm text-charcoal-soft">
            Tutela never auto-replies or messages anyone on your behalf, and every post shows how many
            other shelters have already reached out — so nobody piles on a stranger who mentioned wanting
            a dog. Off by default; turn it on when you're ready.
          </p>
          <Form method="post">
            <input type="hidden" name="intent" value="toggle-enabled" />
            <input type="hidden" name="next" value="1" />
            <button
              disabled={nav.state !== "idle"}
              className="rounded-full bg-meadow text-white px-6 py-3 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
            >
              Turn on Adopter Radar
            </button>
          </Form>
        </div>
      </div>
    );
  }

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Adopter Radar 📡</h1>
          <p className="text-sm text-charcoal-soft max-w-2xl">
            Real people on Bluesky and Reddit saying they want to adopt, refreshed every few hours from
            public posts. If one sounds nearby, reply <em>as yourself</em> from your own account — a warm
            note from a real rescue person is the best marketing that exists. Tutela never auto-replies or
            messages anyone.
          </p>
        </div>
        <Form method="post" className="shrink-0">
          <input type="hidden" name="intent" value="toggle-enabled" />
          <input type="hidden" name="next" value="0" />
          <button className="text-xs font-semibold text-charcoal-soft hover:text-charcoal underline">
            Turn off
          </button>
        </Form>
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
              {Boolean(pileup[String(p.id)]) && (
                <p className="mt-1.5 text-xs font-semibold text-terracotta-deep">
                  {pileup[String(p.id)]} other shelter{pileup[String(p.id)] === 1 ? "" : "s"} already reached out —
                  maybe let this one be.
                </p>
              )}
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
