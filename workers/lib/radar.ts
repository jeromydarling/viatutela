/**
 * Adopter Radar — watches OPEN public networks (Bluesky's public search
 * API, Reddit's public JSON) for people saying they want to adopt, and
 * surfaces those posts to shelters with an AI-drafted warm reply.
 *
 * Hard rules: read-only public data from platforms that permit it; we
 * NEVER auto-post, auto-DM, or contact anyone — a human at the shelter
 * replies from their own account, or nobody does. Posts age out after
 * 30 days.
 */

import { newId } from "./ids";
import { structured } from "./ai-shelter";

// phrases people actually type when they're ready to adopt
export const RADAR_QUERIES = [
  `"looking to adopt" dog`,
  `"looking to adopt" cat`,
  `"want to adopt a" puppy OR kitten`,
  `"ready to adopt" dog OR cat`,
];

const ANIMAL_RE = /\b(dog|dogs|cat|cats|puppy|puppies|kitten|kittens|pup|rabbit|bunny|pets?)\b/i;
const INTENT_RE =
  /\b(looking to adopt|looking into adopting|want(ing)? to adopt|ready to adopt|hoping to adopt|thinking (about|of) adopting|planning (on|to) adopt|where (can|should|do) (i|we) adopt|adopt a (dog|cat|puppy|kitten|rabbit|pet))\b/i;
// the classic false positives: children, highways, and finished stories
const EXCLUDE_RE = /\b(child|children|kid|kids|baby|babies|son|daughter|highway|adopted (a|our|my|him|her|them))\b/i;

/** Pure: does this text read as live pet-adoption intent? */
export function isAdoptionIntent(text: string): boolean {
  const t = text.slice(0, 1000);
  return INTENT_RE.test(t) && ANIMAL_RE.test(t) && !EXCLUDE_RE.test(t);
}

export interface RadarCandidate {
  source: "bluesky" | "reddit";
  postKey: string;
  author: string;
  text: string;
  url: string;
  postedAt: string | null;
}

// ---------- fetchers (public, unauthenticated, generous timeouts) ----------

async function fetchBluesky(query: string): Promise<RadarCandidate[]> {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=25&sort=latest`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "TutelaRadar/1.0 (viatutela.pet; shelter software)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    posts?: { uri?: string; author?: { handle?: string }; record?: { text?: string; createdAt?: string } }[];
  };
  const out: RadarCandidate[] = [];
  for (const p of data.posts ?? []) {
    const uri = String(p.uri ?? "");
    const handle = String(p.author?.handle ?? "");
    const text = String(p.record?.text ?? "").trim();
    const rkey = uri.split("/").pop() ?? "";
    if (!uri || !handle || !text || !rkey) continue;
    out.push({
      source: "bluesky",
      postKey: uri,
      author: `@${handle}`,
      text,
      url: `https://bsky.app/profile/${handle}/post/${rkey}`,
      postedAt: p.record?.createdAt ? String(p.record.createdAt) : null,
    });
  }
  return out;
}

async function fetchReddit(query: string): Promise<RadarCandidate[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25&t=week`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "TutelaRadar/1.0 (viatutela.pet; shelter software)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) return []; // Reddit sometimes blocks datacenter IPs — degrade quietly
  const data = (await resp.json()) as {
    data?: { children?: { data?: { id?: string; author?: string; title?: string; selftext?: string; permalink?: string; created_utc?: number; subreddit?: string } }[] };
  };
  const out: RadarCandidate[] = [];
  for (const child of data.data?.children ?? []) {
    const d = child.data ?? {};
    const text = [d.title, d.selftext].filter(Boolean).join(" — ").trim().slice(0, 800);
    if (!d.id || !d.permalink || !text) continue;
    out.push({
      source: "reddit",
      postKey: String(d.id),
      author: `u/${d.author ?? "unknown"} · r/${d.subreddit ?? ""}`,
      text,
      url: `https://www.reddit.com${d.permalink}`,
      postedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
    });
  }
  return out;
}

/** Cron sweep: fetch, filter for intent, store new posts, prune old ones. */
export async function sweepRadar(env: Env): Promise<void> {
  const candidates: RadarCandidate[] = [];
  for (const q of RADAR_QUERIES) {
    try {
      candidates.push(...(await fetchBluesky(q)));
    } catch (err) {
      console.log(`[radar bluesky] ${err instanceof Error ? err.message : err}`);
    }
  }
  for (const q of [`"looking to adopt" (dog OR cat)`, `"where should I adopt" (dog OR cat OR kitten OR puppy)`]) {
    try {
      candidates.push(...(await fetchReddit(q)));
    } catch (err) {
      console.log(`[radar reddit] ${err instanceof Error ? err.message : err}`);
    }
  }

  const fresh = candidates.filter((c) => isAdoptionIntent(c.text));
  if (fresh.length) {
    const stmts = fresh.map((c) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO radar_posts (id, source, post_key, author, text, url, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(newId("rp"), c.source, c.postKey, c.author.slice(0, 120), c.text.slice(0, 800), c.url.slice(0, 400), c.postedAt),
    );
    await env.DB.batch(stmts);
  }
  await env.DB.prepare(`DELETE FROM radar_posts WHERE fetched_at < datetime('now', '-30 days')`).run();
}

// ---------- AI reply drafting (human sends it — always) ----------

export async function draftRadarReply(
  env: Env,
  args: { orgId: string; postText: string; orgName: string; orgSlug: string; origin: string },
): Promise<{ reply?: string; error?: string }> {
  const schema = {
    type: "object",
    properties: { reply: { type: "string" } },
    required: ["reply"],
    additionalProperties: false,
  };
  const prompt = `Someone posted publicly that they want to adopt a pet. A real person from ${args.orgName} (an animal shelter/rescue) wants to reply warmly and helpfully — not as an ad.

THEIR POST: "${args.postText.slice(0, 600)}"

Write a short reply (2-3 sentences max) that:
- sounds like a friendly human volunteer, not a brand
- gently mentions the shelter has friends looking for homes, with the link ${args.origin}/adopt/${args.orgSlug}
- matches their situation if the post gives one (species, first-time owner, etc.)
- never pressures, never uses marketing-speak, no hashtags, at most one emoji
Return { reply }.`;

  const res = await structured<{ reply: string }>(env, prompt, schema, 400, {
    orgId: args.orgId,
    feature: "radar_reply",
  });
  if (res.error || !res.data) return { error: res.error ?? "No draft came back." };
  return { reply: String(res.data.reply ?? "").slice(0, 800) };
}
