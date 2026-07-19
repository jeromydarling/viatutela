/**
 * AI shelter helpers — matchmaking, application triage, bio writing,
 * care insights, and note summarization.
 *
 * Same rules as the site designer: server-side only, degrades to a
 * friendly message without ANTHROPIC_API_KEY, never auto-applies output
 * to records (staff click to accept), and every generation is
 * audit-logged by the calling route via logAiWrite.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, AI_UNAVAILABLE, MODEL } from "./ai";

/** Compact animal profile fed to prompts — small on purpose (token budget). */
export interface CompactAnimal {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  age: string | null;
  days_in_care: number | null;
  bonded: boolean;
  description: string | null;
}

export function daysBetween(from: string | null | undefined, today: string): number | null {
  if (!from) return null;
  const a = Date.parse(from);
  const b = Date.parse(today);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const days = Math.floor((b - a) / 86_400_000);
  return days >= 0 ? days : null;
}

export function ageLabelFromDob(dob: string | null | undefined, today: string): string | null {
  const days = daysBetween(dob, today);
  if (days == null) return null;
  const years = days / 365.25;
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months`;
  return `${Math.floor(years)} year${years >= 2 ? "s" : ""}`;
}

export function compactAnimal(
  row: Record<string, unknown>,
  today = new Date().toISOString().slice(0, 10),
): CompactAnimal {
  return {
    id: String(row.id),
    name: String(row.name ?? "").slice(0, 60),
    species: row.species ? String(row.species) : null,
    breed: row.breed ? String(row.breed).slice(0, 60) : null,
    sex: row.sex ? String(row.sex) : null,
    age: ageLabelFromDob(row.dob as string | null, today),
    days_in_care: daysBetween(row.intake_date as string | null, today),
    bonded: Boolean(row.bonded_group_id),
    description: row.description ? String(row.description).slice(0, 400) : null,
  };
}

/**
 * KV-backed hourly rate limiter for AI endpoints (the public quiz above
 * all). Fails closed on limit, open on KV trouble — a broken limiter
 * should never take the feature down.
 */
export async function checkAiRateLimit(env: Env, key: string, limit: number): Promise<boolean> {
  try {
    const k = `airl:${key}:${new Date().toISOString().slice(0, 13)}`;
    const n = Number((await env.CONFIG.get(k)) ?? "0");
    if (n >= limit) return false;
    await env.CONFIG.put(k, String(n + 1), { expirationTtl: 4000 });
    return true;
  } catch {
    return true;
  }
}

/** Per-shelter usage bookkeeping — feeds quotas and a cost view later. */
export async function recordAiUsage(
  env: Env,
  orgId: string,
  feature: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO ai_usage (id, org_id, feature, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(`aiu_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, orgId, feature, usage?.input_tokens ?? 0, usage?.output_tokens ?? 0)
      .run();
  } catch (err) {
    console.log(`[ai usage log failed] ${err instanceof Error ? err.message : err}`);
  }
}

/** True when ANY provider (Anthropic key or Workers AI fallback) exists. */
export { aiAvailable } from "./ai-flags";

/**
 * Per-org daily AI budget (total tokens/day from ai_usage). Plan-based
 * defaults, overridable with the AI_DAILY_TOKEN_LIMIT var. A gate, not
 * a meter — it stops runaway cost, especially on public endpoints.
 */
const DAILY_TOKEN_LIMITS: Record<string, number> = { starter: 150_000, free: 150_000, rescue: 750_000, pro: 2_000_000 };

export async function checkAiBudget(env: Env, orgId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const override = Number((env as { AI_DAILY_TOKEN_LIMIT?: string }).AI_DAILY_TOKEN_LIMIT);
    const row = await env.DB.prepare(
      `SELECT o.plan, (SELECT COALESCE(SUM(u.input_tokens + u.output_tokens), 0) FROM ai_usage u
         WHERE u.org_id = o.id AND u.created_at >= date('now')) spent
       FROM orgs o WHERE o.id = ?`,
    )
      .bind(orgId)
      .first<{ plan: string; spent: number }>();
    if (!row) return { ok: true };
    const limit = Number.isFinite(override) && override > 0 ? override : (DAILY_TOKEN_LIMITS[row.plan] ?? 300_000);
    if (row.spent >= limit) {
      return {
        ok: false,
        error: "Today's AI budget is used up — it refills at midnight UTC. (Plenty of kibble tomorrow.)",
      };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // a broken meter never takes the feature down
  }
}

/** Pure: pull the first complete JSON object out of model prose. */
export function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

const LLAMA_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface WorkersAi {
  run(model: string, input: Record<string, unknown>): Promise<{ response?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }>;
}

/** Workers AI (Llama) fallback — keeps the lights on when Claude is down. */
async function llamaStructured<T>(
  env: Env,
  prompt: string,
  schema: Record<string, unknown>,
  maxTokens: number,
  track?: { orgId: string; feature: string },
): Promise<{ data?: T; error?: string }> {
  const ai = (env as { AI?: WorkersAi }).AI;
  if (!ai) return { error: AI_UNAVAILABLE };
  try {
    const result = await ai.run(LLAMA_MODEL, {
      messages: [
        {
          role: "system",
          content: `Respond with EXACTLY ONE JSON object matching this JSON Schema, no prose, no markdown fences:\n${JSON.stringify(schema)}`,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: Math.min(maxTokens, 4000),
    });
    if (track) {
      await recordAiUsage(env, track.orgId, `${track.feature}:llama`, {
        input_tokens: result.usage?.prompt_tokens ?? 0,
        output_tokens: result.usage?.completion_tokens ?? 0,
      });
    }
    const raw = extractJson(result.response ?? "");
    if (!raw) return { error: "The backup AI came back empty — try again." };
    return { data: JSON.parse(raw) as T };
  } catch (err) {
    console.log(`[llama fallback failed] ${err instanceof Error ? err.message : err}`);
    return { error: "The AI hit a snag — try again in a moment." };
  }
}

/**
 * One structured-output call; refusal-safe, JSON-safe, never throws.
 * Budget-gated per org, and falls back to Workers AI (Llama) when the
 * Anthropic API is unconfigured or errors.
 */
export async function structured<T>(
  env: Env,
  prompt: string,
  schema: Record<string, unknown>,
  maxTokens: number,
  track?: { orgId: string; feature: string; system?: string },
): Promise<{ data?: T; error?: string }> {
  if (track) {
    const budget = await checkAiBudget(env, track.orgId);
    if (!budget.ok) return { error: budget.error };
  }
  const client = getAnthropic(env);
  if (!client) return llamaStructured<T>(env, prompt, schema, maxTokens, track);
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { format: { type: "json_schema", schema } },
      ...(track?.system ? { system: track.system } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    if (track) await recordAiUsage(env, track.orgId, track.feature, response.usage);
    if (response.stop_reason === "refusal") return { error: "The AI declined that one — try rephrasing." };
    const out = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!out?.text) return { error: "The AI came back empty — try again." };
    return { data: JSON.parse(out.text) as T };
  } catch (err) {
    console.log(`[anthropic failed, trying llama] ${err instanceof Error ? err.message : err}`);
    return llamaStructured<T>(env, prompt, schema, maxTokens, track);
  }
}

const VOICE =
  `Voice: warm, plain, generous, joyful — animals are "friends," never inventory. No religious language.`;

const clamp = (n: unknown, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

// ---------------------------------------------------------------------------
// 1. Application triage — score, flags, better fits, draft reply
// ---------------------------------------------------------------------------

export interface AppReview {
  fit_score: number; // 0-100
  summary: string;
  green_flags: string[];
  red_flags: string[];
  better_fits: { animal_id: string; name: string; reason: string }[];
  draft_reply: string;
  generated_at: string;
}

export async function reviewApplication(
  env: Env,
  args: {
    application: { name: string; email: string; phone: string | null; home_type: string | null; message: string | null; interest?: string | null };
    animal: CompactAnimal | null;
    others: CompactAnimal[];
    priorAdoptions: number;
  },
): Promise<{ review?: AppReview; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      fit_score: { type: "integer" },
      summary: { type: "string" },
      green_flags: { type: "array", items: { type: "string" } },
      red_flags: { type: "array", items: { type: "string" } },
      better_fits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            animal_id: { type: "string" },
            reason: { type: "string" },
          },
          required: ["animal_id", "reason"],
          additionalProperties: false,
        },
      },
      draft_reply: { type: "string" },
    },
    required: ["fit_score", "summary", "green_flags", "red_flags", "better_fits", "draft_reply"],
    additionalProperties: false,
  };

  const prompt = `You are helping animal-shelter staff triage an adoption application. Staff always make the final call — you rank and flag, nothing more. ${VOICE}

APPLICATION:
- Applicant: ${args.application.name}
- Home type: ${args.application.home_type ?? "not stated"}
- They said they want to: ${args.application.interest ?? "adopt"}
- Their message: ${(args.application.message ?? "none").slice(0, 2000)}
- Prior completed adoptions from this shelter: ${args.priorAdoptions}

ANIMAL THEY APPLIED FOR:
${args.animal ? JSON.stringify(args.animal) : "None — they're open to any friend."}

OTHER ANIMALS CURRENTLY LOOKING FOR HOMES (for better-fit suggestions; use exact animal_id values from this list only):
${JSON.stringify(args.others.slice(0, 30))}

Assess:
- fit_score: 0-100 for THIS applicant with THIS animal (if no animal, score their overall readiness). Be honest, not harsh — a sparse application is a "needs more info," not a rejection.
- summary: 2-3 plain sentences for staff.
- green_flags / red_flags: short concrete bullets drawn ONLY from what they actually wrote (never invent facts; missing info is a flag like "no mention of landlord approval," not a fault).
- better_fits: up to 3 animals from the list that may suit this home BETTER than the one applied for (empty array if the applied-for animal is already a good match or there's no basis to judge).
- draft_reply: a short, warm email staff could send asking for the missing information or suggesting next steps. Sign off as "The team". Never promise approval or denial.`;

  const res = await structured<Omit<AppReview, "generated_at">>(env, prompt, schema, 3000);
  if (res.error || !res.data) return { error: res.error ?? "No result." };

  const byId = new Map(args.others.map((a) => [a.id, a]));
  const better_fits = (Array.isArray(res.data.better_fits) ? res.data.better_fits : [])
    .filter((b) => byId.has(b.animal_id))
    .slice(0, 3)
    .map((b) => ({ animal_id: b.animal_id, name: byId.get(b.animal_id)!.name, reason: String(b.reason).slice(0, 300) }));

  return {
    review: {
      fit_score: clamp(res.data.fit_score, 0, 100),
      summary: String(res.data.summary ?? "").slice(0, 1000),
      green_flags: (res.data.green_flags ?? []).slice(0, 6).map((s) => String(s).slice(0, 200)),
      red_flags: (res.data.red_flags ?? []).slice(0, 6).map((s) => String(s).slice(0, 200)),
      better_fits,
      draft_reply: String(res.data.draft_reply ?? "").slice(0, 3000),
      generated_at: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Public match quiz — adopter answers → ranked matches
// ---------------------------------------------------------------------------

export interface MatchOutcome {
  matches: { animal_id: string; score: number; reason: string }[];
  note: string;
}

export async function matchAnimals(
  env: Env,
  args: { answers: Record<string, string>; animals: CompactAnimal[]; orgName: string },
): Promise<{ result?: MatchOutcome; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            animal_id: { type: "string" },
            score: { type: "integer" },
            reason: { type: "string" },
          },
          required: ["animal_id", "score", "reason"],
          additionalProperties: false,
        },
      },
      note: { type: "string" },
    },
    required: ["matches", "note"],
    additionalProperties: false,
  };

  const prompt = `You are the friendly matchmaker for ${args.orgName}, an animal shelter. An adopter answered a short quiz; rank the shelter's ACTUAL available animals for their home. ${VOICE}

ADOPTER'S ANSWERS:
${JSON.stringify(args.answers)}

AVAILABLE ANIMALS (use exact animal_id values from this list only):
${JSON.stringify(args.animals.slice(0, 60))}

Return:
- matches: the top 3-5 animals (fewer if the list is small), each with score 0-100 and a 1-2 sentence reason written TO the adopter ("Mochi would love your quiet apartment…"). Consider energy needs vs home, kids, other pets, experience. Bonded animals go home with their partner — mention it.
- note: one warm sentence. If nothing fits well, say so honestly and suggest talking to the shelter.
Never invent animals or facts not in the list.`;

  const res = await structured<MatchOutcome>(env, prompt, schema, 2500);
  if (res.error || !res.data) return { error: res.error ?? "No result." };

  const ids = new Set(args.animals.map((a) => a.id));
  const matches = (Array.isArray(res.data.matches) ? res.data.matches : [])
    .filter((m) => ids.has(m.animal_id))
    .slice(0, 5)
    .map((m) => ({ animal_id: m.animal_id, score: clamp(m.score, 0, 100), reason: String(m.reason).slice(0, 400) }));
  return { result: { matches, note: String(res.data.note ?? "").slice(0, 400) } };
}

// ---------------------------------------------------------------------------
// 3. Bio writing — profile bio + Petfinder blurb + social post
// ---------------------------------------------------------------------------

export interface BioPack {
  bio: string;
  petfinder_blurb: string;
  social_post: string;
}

export async function writeBio(
  env: Env,
  args: { animal: CompactAnimal; facts: string; orgName: string; medicalNote: string | null },
): Promise<{ pack?: BioPack; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      bio: { type: "string" },
      petfinder_blurb: { type: "string" },
      social_post: { type: "string" },
    },
    required: ["bio", "petfinder_blurb", "social_post"],
    additionalProperties: false,
  };

  const prompt = `Write adoption copy for a real animal at ${args.orgName}. ${VOICE} Specific beats generic — use the facts given, never invent medical or behavioral claims.

THE FRIEND:
${JSON.stringify(args.animal)}
Staff's quick facts about them: ${args.facts.slice(0, 1500) || "none given — work from the profile"}
Medical context (mention only if adopter-relevant, gently): ${args.medicalNote ?? "none"}

Return:
- bio: 2-3 short paragraphs for their adoption page. Lead with personality, not stats. End with an invitation to meet.
- petfinder_blurb: ≤400 characters, plain text, front-loads the hook.
- social_post: 1-2 sentences + a call to action for the shelter's social media; include the animal's name; no hashtag stuffing (2 max).`;

  const res = await structured<BioPack>(env, prompt, schema, 2500);
  if (res.error || !res.data) return { error: res.error ?? "No result." };
  return {
    pack: {
      bio: String(res.data.bio ?? "").slice(0, 4000),
      petfinder_blurb: String(res.data.petfinder_blurb ?? "").slice(0, 500),
      social_post: String(res.data.social_post ?? "").slice(0, 600),
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Shelter insights — long-stay alerts + patterns from real stats
// ---------------------------------------------------------------------------

export interface Insights {
  headline: string;
  highlights: string[];
  long_stay: { animal_id: string; name: string; advice: string }[];
  try_next: string[];
  generated_at: string;
}

export async function shelterInsights(
  env: Env,
  args: {
    orgName: string;
    stats: Record<string, unknown>;
    longStayers: (CompactAnimal & { applications: number })[];
  },
): Promise<{ insights?: Insights; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      headline: { type: "string" },
      highlights: { type: "array", items: { type: "string" } },
      long_stay: {
        type: "array",
        items: {
          type: "object",
          properties: {
            animal_id: { type: "string" },
            advice: { type: "string" },
          },
          required: ["animal_id", "advice"],
          additionalProperties: false,
        },
      },
      try_next: { type: "array", items: { type: "string" } },
    },
    required: ["headline", "highlights", "long_stay", "try_next"],
    additionalProperties: false,
  };

  const prompt = `You are an operations advisor for ${args.orgName}, an animal shelter. Read their real numbers and give practical, kind, non-judgmental guidance. ${VOICE} Small shelters, small budgets — suggest free or cheap actions (better photos, bio rewrites, fee-waived weekends, foster features, social posts), never expensive software or staff hires.

THEIR NUMBERS (last 12 months unless noted):
${JSON.stringify(args.stats)}

FRIENDS WAITING LONGEST (with application counts; use exact animal_id values from this list only):
${JSON.stringify(args.longStayers.slice(0, 12))}

Return:
- headline: one sentence, the single most useful observation.
- highlights: 3-5 short observations grounded in the numbers (call out real trends; if data is thin, say what to start tracking).
- long_stay: for up to 6 of the longest-waiting friends, one specific suggestion each to get them noticed (reference their actual profile — a thin description means "rewrite the bio," zero applications after 60 days means "new photos + featured post").
- try_next: 2-4 concrete actions for the coming month.`;

  const res = await structured<Omit<Insights, "generated_at" | "long_stay"> & { long_stay: { animal_id: string; advice: string }[] }>(
    env,
    prompt,
    schema,
    3000,
  );
  if (res.error || !res.data) return { error: res.error ?? "No result." };

  const byId = new Map(args.longStayers.map((a) => [a.id, a]));
  return {
    insights: {
      headline: String(res.data.headline ?? "").slice(0, 300),
      highlights: (res.data.highlights ?? []).slice(0, 6).map((s) => String(s).slice(0, 300)),
      long_stay: (res.data.long_stay ?? [])
        .filter((l) => byId.has(l.animal_id))
        .slice(0, 6)
        .map((l) => ({ animal_id: l.animal_id, name: byId.get(l.animal_id)!.name, advice: String(l.advice).slice(0, 300) })),
      try_next: (res.data.try_next ?? []).slice(0, 4).map((s) => String(s).slice(0, 300)),
      generated_at: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Note summarization — adopter handoff + vet brief
// ---------------------------------------------------------------------------

export interface HandoffPack {
  adopter_summary: string;
  vet_brief: string;
}

export async function summarizeNotes(
  env: Env,
  args: {
    animal: CompactAnimal;
    medical: { date: string | null; type: string | null; description: string | null; vet: string | null; due_date: string | null }[];
    fosterNotes: string[];
  },
): Promise<{ pack?: HandoffPack; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      adopter_summary: { type: "string" },
      vet_brief: { type: "string" },
    },
    required: ["adopter_summary", "vet_brief"],
    additionalProperties: false,
  };

  const prompt = `Summarize a shelter animal's records for two audiences. Work ONLY from the records below — never invent, soften, or omit a medical fact. If records are sparse, say so plainly.

THE FRIEND:
${JSON.stringify(args.animal)}

MEDICAL RECORDS (newest first):
${JSON.stringify(args.medical.slice(0, 60))}

FOSTER NOTES:
${JSON.stringify(args.fosterNotes.slice(0, 20))}

Return:
- adopter_summary: one warm, honest paragraph for the new family — temperament observations from foster notes, key medical history in plain words, anything due soon ("rabies booster due in March"). ${VOICE}
- vet_brief: a clinical, chronological brief for their first vet visit — dated vaccines/procedures/treatments, upcoming due dates, prior clinics. Plain factual tone, no warmth needed.`;

  const res = await structured<HandoffPack>(env, prompt, schema, 2500);
  if (res.error || !res.data) return { error: res.error ?? "No result." };
  return {
    pack: {
      adopter_summary: String(res.data.adopter_summary ?? "").slice(0, 3000),
      vet_brief: String(res.data.vet_brief ?? "").slice(0, 4000),
    },
  };
}
