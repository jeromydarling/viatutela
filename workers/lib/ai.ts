/**
 * AI site designer — server-side calls to the Anthropic API.
 *
 * Degrades cleanly: if ANTHROPIC_API_KEY is unset, callers get a friendly
 * "needs an API key" result instead of a crash. AI output is NEVER
 * auto-published — the interview creates drafts only. Every AI write is
 * audit-logged by the calling route.
 */

import Anthropic from "@anthropic-ai/sdk";
import { validateSections, SECTION_TYPES, type Section } from "./site-sections";

export const MODEL = "claude-opus-4-8";

export function getAnthropic(env: Env): Anthropic | null {
  const key = (env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export const AI_UNAVAILABLE =
  "The AI designer needs an Anthropic API key. Set the ANTHROPIC_API_KEY secret on the Worker (Cloudflare dash → Workers → viatutela → Settings → Variables) and it lights up — everything else works without it.";

export interface InterviewAnswers {
  shelter_name: string;
  town: string;
  animals: string;
  story: string;
  tone: string;
  org_slug: string;
}

export interface StarterSite {
  tagline: string;
  nav: { label: string; href: string }[];
  pages: {
    slug: string;
    title: string;
    subtitle?: string;
    meta_title: string;
    meta_description: string;
    sections: Section[];
  }[];
}

/** Keep only sections with a valid type; enforce the global caps. */
function cleanSections(input: unknown): Section[] {
  if (!Array.isArray(input)) return [];
  const kept = input.filter(
    (s) =>
      s &&
      typeof s === "object" &&
      typeof (s as { type?: unknown }).type === "string" &&
      (SECTION_TYPES as readonly string[]).includes((s as { type: string }).type),
  ) as Section[];
  const v = validateSections(kept.slice(0, 40));
  return v.ok ? v.sections : [];
}

export async function generateStarterSite(
  env: Env,
  a: InterviewAnswers,
): Promise<{ site?: StarterSite; error?: string }> {
  const client = getAnthropic(env);
  if (!client) return { error: AI_UNAVAILABLE };

  const sectionCatalog = `
Section types and their fields (all fields are strings unless noted):
- home_hero: eyebrow, heading, sub, cta_label, cta_href
- hero: heading, sub
- prose: md (markdown: ##/### headings, **bold**, *italic*, [links](url), - lists)
- image_text: heading, md, image_side ("left"|"right")   (omit image_url — the shelter adds photos later)
- adoptable_grid: heading, species (optional), limit (number, default 6) — renders LIVE adoptable animals
- success_stories: heading, items: [{title, text}]
- gallery: heading, items: []   (leave items empty — photos come later)
- quote: text, attribution
- faq: heading, items: [{q, a}]
- cta_band: heading, text, primary_label, primary_href, secondary_label, secondary_href
- events_strip: heading, items: [{date, title, place, text}]
- newsletter_signup: heading, text`;

  const prompt = `You are designing the complete starter website for an animal shelter on the Tutela platform. Voice: warm, plain, generous, joyful — animals are "friends," never inventory. No religious language.

Shelter details from their interview:
- Name: ${a.shelter_name}
- Town/area: ${a.town}
- Animals they take in: ${a.animals}
- Their story: ${a.story}
- Tone they asked for: ${a.tone}

Site link conventions (use these exact href shapes):
- Site pages: /s/${a.org_slug} (home), /s/${a.org_slug}/<page-slug>
- Live adoption catalog: /adopt/${a.org_slug}
${sectionCatalog}

Return EXACTLY ONE JSON object, no prose before or after, with this shape:
{
  "tagline": "one warm sentence",
  "nav": [{"label": "...", "href": "..."}],       // 4-6 links, Home first
  "pages": [
    {
      "slug": "home" | "about" | "adopt" | "donate" | "volunteer" | "faq",
      "title": "...",
      "subtitle": "...",
      "meta_title": "≤60 chars, includes shelter name",
      "meta_description": "≤155 chars",
      "sections": [ {"type": "...", ...fields} ]
    }
  ]
}

Requirements: exactly those six pages; the homepage starts with home_hero and includes an adoptable_grid and a cta_band and a newsletter_signup; adopt includes an adoptable_grid and a faq about their adoption process; write real, specific copy from their story — not lorem ipsum, not generic filler; 3-6 sections per page.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      return { error: "The AI couldn't help with that request — please adjust your answers and try again." };
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return { error: "The AI answer wasn't valid JSON — try again." };
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

    const pagesRaw = Array.isArray(raw.pages) ? raw.pages : [];
    const pages: StarterSite["pages"] = [];
    for (const p of pagesRaw.slice(0, 8)) {
      if (!p || typeof p !== "object") continue;
      const page = p as Record<string, unknown>;
      const slug = String(page.slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      const title = String(page.title ?? "").trim();
      if (!slug || !title) continue;
      pages.push({
        slug,
        title: title.slice(0, 120),
        subtitle: typeof page.subtitle === "string" ? page.subtitle.slice(0, 300) : undefined,
        meta_title: String(page.meta_title ?? title).slice(0, 70),
        meta_description: String(page.meta_description ?? "").slice(0, 170),
        sections: cleanSections(page.sections),
      });
    }
    if (!pages.length) return { error: "The AI didn't produce usable pages — try again." };

    const nav = (Array.isArray(raw.nav) ? raw.nav : [])
      .filter(
        (l): l is { label: string; href: string } =>
          !!l && typeof (l as { label?: unknown }).label === "string" && typeof (l as { href?: unknown }).href === "string",
      )
      .slice(0, 8)
      .map((l) => ({ label: l.label.slice(0, 40), href: l.href.slice(0, 200) }));

    return {
      site: {
        tagline: String(raw.tagline ?? "").slice(0, 200),
        nav,
        pages,
      },
    };
  } catch (err) {
    console.log(`[ai site starter failed] ${err instanceof Error ? err.message : err}`);
    return { error: "The AI designer hit a snag — give it another try in a moment." };
  }
}

const REWRITE_MODES: Record<string, string> = {
  warmer: "Rewrite it warmer and more welcoming, keeping every fact.",
  punchier: "Rewrite it punchier and more energetic, keeping every fact.",
  shorter: "Rewrite it at roughly half the length, keeping the most important facts.",
};

export async function rewriteText(
  env: Env,
  text: string,
  mode: string,
): Promise<{ text?: string; error?: string }> {
  const client = getAnthropic(env);
  if (!client) return { error: AI_UNAVAILABLE };
  const instruction = REWRITE_MODES[mode] ?? REWRITE_MODES.warmer;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `This is website copy for an animal shelter (voice: warm, plain, generous; animals are "friends"). ${instruction} Preserve any markdown formatting.\n\n---\n${text.slice(0, 8000)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return { error: "The AI declined that one." };
    const out = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const parsed = JSON.parse(out?.text ?? "{}") as { text?: string };
    if (!parsed.text) return { error: "The AI came back empty — try again." };
    return { text: parsed.text };
  } catch (err) {
    console.log(`[ai rewrite failed] ${err instanceof Error ? err.message : err}`);
    return { error: "The AI rewrite hit a snag — try again in a moment." };
  }
}

export async function draftMeta(
  env: Env,
  pageTitle: string,
  orgName: string,
  contentSummary: string,
): Promise<{ meta_title?: string; meta_description?: string; error?: string }> {
  const client = getAnthropic(env);
  if (!client) return { error: AI_UNAVAILABLE };
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              meta_title: { type: "string" },
              meta_description: { type: "string" },
            },
            required: ["meta_title", "meta_description"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `Write SEO metadata for a page on an animal shelter's website.\nShelter: ${orgName}\nPage: ${pageTitle}\nPage content:\n${contentSummary.slice(0, 4000)}\n\nmeta_title: ≤60 characters, include the shelter name. meta_description: ≤155 characters, warm and specific, no clickbait.`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return { error: "The AI declined that one." };
    const out = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const parsed = JSON.parse(out?.text ?? "{}") as { meta_title?: string; meta_description?: string };
    if (!parsed.meta_title) return { error: "The AI came back empty — try again." };
    return {
      meta_title: parsed.meta_title.slice(0, 70),
      meta_description: (parsed.meta_description ?? "").slice(0, 170),
    };
  } catch (err) {
    console.log(`[ai meta failed] ${err instanceof Error ? err.message : err}`);
    return { error: "The AI hit a snag — try again in a moment." };
  }
}

export async function logAiWrite(
  env: Env,
  orgId: string,
  userId: string | null,
  kind: string,
  detail: string,
): Promise<void> {
  await env.DB.prepare(`INSERT INTO ai_audit (org_id, user_id, kind, detail) VALUES (?, ?, ?, ?)`)
    .bind(orgId, userId, kind, detail.slice(0, 2000))
    .run();
}
