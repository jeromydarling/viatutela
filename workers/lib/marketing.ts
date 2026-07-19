/**
 * Marketing Studio — channels as data, generation with server-enforced
 * caps, and content ideas from the shelter's real records.
 *
 * NOTHING here auto-publishes anywhere. Every asset is a draft the
 * shelter edits, schedules, copies out, and marks posted — that's a
 * feature, and the UI says so.
 */

import { structured } from "./ai-shelter";

export interface Channel {
  channel: string;
  label: string;
  kind: "post" | "story" | "script" | "email" | "article" | "press" | "ads" | "pin";
  /** Exact JSON contract the model must return for this channel. */
  guidance: string;
  /** server-side caps applied after parsing — models drift */
  caps: { title?: number; content?: number };
}

/** The channel catalog — drives both generation prompts and the UI. */
export const CHANNELS: Channel[] = [
  {
    channel: "facebook",
    label: "Facebook post",
    kind: "post",
    guidance: `{"title": "internal label", "content": "80-120 words, warm and specific, ONE clear link call-to-action at the end"}`,
    caps: { title: 80, content: 1200 },
  },
  {
    channel: "instagram",
    label: "Instagram post",
    kind: "post",
    guidance: `{"title": "internal label", "content": "caption <=150 words, no hashtags inline", "meta": {"hashtags": ["18-24 specific niche tags mixing #adoptdontshop-style, breed, and city tags — no # symbol in the strings"]}}`,
    caps: { title: 80, content: 1500 },
  },
  {
    channel: "story",
    label: "Story (3 frames)",
    kind: "story",
    guidance: `{"title": "internal label", "content": "FRAME 1: what's on screen — overlay text (<=10 words)\\nFRAME 2: …\\nFRAME 3: …"}`,
    caps: { title: 80, content: 900 },
  },
  {
    channel: "reel",
    label: "TikTok / Reel script",
    kind: "script",
    guidance: `{"title": "internal label", "content": "30-second script: HOOK (0-3s): exactly what to film + say. BEAT 1/2/3: what to film (a SPECIFIC animal doing a specific thing) + voiceover line. CTA: closing line."}`,
    caps: { title: 80, content: 1500 },
  },
  {
    channel: "x",
    label: "X post",
    kind: "post",
    guidance: `{"title": "internal label", "content": "<=270 characters, one link placeholder {{SITE_URL}}"}`,
    caps: { title: 80, content: 270 },
  },
  {
    channel: "pinterest",
    label: "Pinterest pin",
    kind: "pin",
    guidance: `{"title": "keyword-forward pin title <=100 chars", "content": "searchable description <=450 chars, natural keywords, no hashtag spam"}`,
    caps: { title: 100, content: 450 },
  },
  {
    channel: "email",
    label: "Email to supporters",
    kind: "email",
    guidance: `{"title": "subject line <=55 chars", "content": "~150-word plain-text email body; include a {{SITE_URL}} call-to-action line; sign as the shelter", "meta": {"altSubjects": ["2 alternate subjects <=55 chars each"]}}`,
    caps: { title: 55, content: 2000 },
  },
  {
    channel: "blog",
    label: "Blog / news article",
    kind: "article",
    guidance: `{"title": "article headline", "content": "~450-word markdown article with ## sections — editorial storytelling, NOT an ad", "meta": {"keywords": ["4-6 SEO phrases"], "slug": "url-friendly-slug"}}`,
    caps: { title: 120, content: 5000 },
  },
  {
    channel: "press",
    label: "Press release",
    kind: "press",
    guidance: `{"title": "news-style headline", "content": "CITY, STATE — date line. News-first paragraphs (who/what/when/why it matters locally), one quote from the shelter director, closing '# # #', then a one-paragraph About boilerplate."}`,
    caps: { title: 140, content: 3500 },
  },
  {
    channel: "google_ads",
    label: "Google ads (Ad Grants)",
    kind: "ads",
    guidance: `{"title": "internal label", "content": "one-line summary of the ad angle", "meta": {"headlines": ["5 headlines, each <=30 chars"], "descriptions": ["3 descriptions, each <=90 chars"]}}`,
    caps: { title: 80, content: 300 },
  },
  {
    channel: "meta_ads",
    label: "Facebook/Instagram ads",
    kind: "ads",
    guidance: `{"title": "internal label", "content": "one-line summary of the ad angle", "meta": {"variants": [{"primaryText": "<=125 chars", "headline": "<=40 chars", "description": "<=30 chars"}, {"...": "3 variants total"}]}}`,
    caps: { title: 80, content: 300 },
  },
];

export const channelByKey = new Map(CHANNELS.map((c) => [c.channel, c]));

export interface GeneratedAsset {
  channel: string;
  kind: string;
  title: string;
  content: string;
  meta: Record<string, unknown>;
}

/** Enforce catalog caps + per-meta character limits after parsing. */
export function enforceCaps(channel: Channel, asset: { title?: unknown; content?: unknown; meta?: unknown }): GeneratedAsset {
  const meta = (asset.meta && typeof asset.meta === "object" ? asset.meta : {}) as Record<string, unknown>;
  const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

  if (Array.isArray(meta.hashtags)) meta.hashtags = meta.hashtags.slice(0, 24).map((h) => clip(h, 40).replace(/^#/, ""));
  if (Array.isArray(meta.altSubjects)) meta.altSubjects = meta.altSubjects.slice(0, 2).map((s) => clip(s, 55));
  if (Array.isArray(meta.keywords)) meta.keywords = meta.keywords.slice(0, 6).map((k) => clip(k, 60));
  if (typeof meta.slug === "string") meta.slug = meta.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  if (Array.isArray(meta.headlines)) meta.headlines = meta.headlines.slice(0, 5).map((h) => clip(h, 30));
  if (Array.isArray(meta.descriptions)) meta.descriptions = meta.descriptions.slice(0, 3).map((d) => clip(d, 90));
  if (Array.isArray(meta.variants)) {
    meta.variants = meta.variants.slice(0, 3).map((v) => {
      const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
      return { primaryText: clip(o.primaryText, 125), headline: clip(o.headline, 40), description: clip(o.description, 30) };
    });
  }
  return {
    channel: channel.channel,
    kind: channel.kind,
    title: clip(asset.title, channel.caps.title ?? 120),
    content: clip(asset.content, channel.caps.content ?? 2000),
    meta,
  };
}

export interface CampaignContext {
  orgId: string;
  orgName: string;
  city: string | null;
  voice: string;
  siteUrl: string;
  campaignName: string;
  objective: string;
  keyMessage: string | null;
  animal: { name: string; species: string | null; breed: string | null; description: string | null; days_in_care: number | null } | null;
}

function campaignBrief(ctx: CampaignContext): string {
  return `Shelter: ${ctx.orgName}${ctx.city ? ` (${ctx.city})` : ""}
Their voice: ${ctx.voice}
Campaign: ${ctx.campaignName} — objective: ${ctx.objective}
Key message: ${ctx.keyMessage ?? "none given — infer from the objective"}
${ctx.animal ? `Featured friend: ${JSON.stringify(ctx.animal)}` : "No specific animal — campaign-level content."}
Where links should point: use the literal placeholder {{SITE_URL}} (it is replaced at send/post time).`;
}

/** Generate one channel's asset. Callers fan out over selected channels. */
export async function generateChannelAsset(
  env: Env,
  ctx: CampaignContext,
  channelKey: string,
): Promise<{ asset?: GeneratedAsset; error?: string }> {
  const channel = channelByKey.get(channelKey);
  if (!channel) return { error: `Unknown channel ${channelKey}.` };

  const strArr = { type: "array", items: { type: "string" } };
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      meta: {
        type: "object",
        properties: {
          hashtags: strArr,
          altSubjects: strArr,
          keywords: strArr,
          slug: { type: "string" },
          headlines: strArr,
          descriptions: strArr,
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                primaryText: { type: "string" },
                headline: { type: "string" },
                description: { type: "string" },
              },
              required: ["primaryText", "headline", "description"],
              additionalProperties: false,
            },
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    required: ["title", "content", "meta"],
    additionalProperties: false,
  };

  const prompt = `You are drafting ${channel.label} content for an animal shelter's marketing campaign. Voice: warm, plain, generous, joyful — animals are "friends," never inventory. No religious language. Never invent facts about animals or events; work only from the brief.

${campaignBrief(ctx)}

Return JSON exactly matching this contract for the "${channel.channel}" channel:
${channel.guidance}`;

  const res = await structured<{ title?: string; content?: string; meta?: Record<string, unknown> }>(
    env,
    prompt,
    schema,
    2500,
    { orgId: ctx.orgId, feature: `marketing_${channel.channel}` },
  );
  if (res.error || !res.data) return { error: res.error ?? "Nothing came back." };
  const asset = enforceCaps(channel, res.data);
  if (!asset.content) return { error: "The draft came back empty — try again." };
  return { asset };
}

/** One-tap campaign starters from the shelter's actual data. */
export interface ContentIdea {
  name: string;
  objective: string;
  animal_id: string | null;
  key_message: string;
}

export async function contentIdeas(
  env: Env,
  args: {
    orgId: string;
    orgName: string;
    voice: string;
    month: string; // e.g. "July"
    longestWaiting: { id: string; name: string; days: number | null; description: string | null }[];
    recentAdoptions: { animal: string; date: string | null }[];
    upcomingReminders: number;
  },
): Promise<{ ideas?: ContentIdea[]; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            objective: { type: "string", enum: ["adoption_push", "success_story", "fundraiser", "event", "seasonal", "evergreen", "press"] },
            animal_id: { type: ["string", "null"] },
            key_message: { type: "string" },
          },
          required: ["name", "objective", "animal_id", "key_message"],
          additionalProperties: false,
        },
      },
    },
    required: ["ideas"],
    additionalProperties: false,
  };

  const prompt = `Suggest 4-6 marketing campaign ideas for ${args.orgName} (an animal shelter), grounded ONLY in their real data below. Voice: ${args.voice}. It is ${args.month}.

Friends waiting longest (use exact id values or null): ${JSON.stringify(args.longestWaiting.slice(0, 8))}
Recent adoptions (success-story material): ${JSON.stringify(args.recentAdoptions.slice(0, 5))}

Each idea: a short campaign name, an objective from the enum, animal_id (an exact id from the list, or null for general campaigns), and a one-sentence key message. Mix at least one adoption_push for a long-waiting friend and one success_story if there are recent adoptions. Seasonal ideas must fit ${args.month}.`;

  const res = await structured<{ ideas: ContentIdea[] }>(env, prompt, schema, 2000, {
    orgId: args.orgId,
    feature: "content_ideas",
  });
  if (res.error || !res.data) return { error: res.error ?? "No ideas came back." };
  const validIds = new Set(args.longestWaiting.map((a) => a.id));
  return {
    ideas: (res.data.ideas ?? []).slice(0, 6).map((i) => ({
      name: String(i.name ?? "").slice(0, 100),
      objective: ["adoption_push", "success_story", "fundraiser", "event", "seasonal", "evergreen", "press"].includes(i.objective) ? i.objective : "evergreen",
      animal_id: i.animal_id && validIds.has(i.animal_id) ? i.animal_id : null,
      key_message: String(i.key_message ?? "").slice(0, 300),
    })),
  };
}

export const OBJECTIVES = [
  ["adoption_push", "Adoption push"],
  ["success_story", "Success story"],
  ["fundraiser", "Fundraiser"],
  ["event", "Event"],
  ["seasonal", "Seasonal"],
  ["evergreen", "Evergreen"],
  ["press", "Press / news"],
] as const;
