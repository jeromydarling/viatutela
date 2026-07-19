/**
 * AI brand-in-a-box: 3 answers → a full brand proposal (palette,
 * typography, wordmark, tagline, voice). The result is a PROPOSAL the
 * shelter applies with one click — never auto-saved — and every field
 * goes through validateBrand's whitelists before it can touch the DB.
 */

import { structured } from "./ai-shelter";
import { validateBrand, FONT_PAIRS, WORDMARK_FONTS, SITE_THEMES, type Brand } from "./brand";

export async function generateBrandProposal(
  env: Env,
  args: { orgId: string; name: string; about: string; vibe: string },
): Promise<{ brand?: Brand; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      palette: {
        type: "object",
        properties: {
          primary: { type: "string" },
          accent: { type: "string" },
          ink: { type: "string" },
          bg: { type: "string" },
        },
        required: ["primary", "accent", "ink", "bg"],
        additionalProperties: false,
      },
      typography: { type: "string", enum: Object.keys(FONT_PAIRS) },
      theme: { type: "string", enum: Object.keys(SITE_THEMES) },
      wordmark: {
        type: "object",
        properties: {
          font: { type: "string", enum: Object.keys(WORDMARK_FONTS) },
          case: { type: "string", enum: ["upper", "title", "lower"] },
          tracking: { type: "integer" },
          weight: { type: "integer" },
        },
        required: ["font", "case", "tracking", "weight"],
        additionalProperties: false,
      },
      tagline: { type: "string" },
      voice: { type: "string" },
    },
    required: ["palette", "typography", "theme", "wordmark", "tagline", "voice"],
    additionalProperties: false,
  };

  const prompt = `Design a visual identity for an animal shelter. Warm and professional — this brand must work on a donation button and a lost-dog poster alike.

Shelter name: ${args.name.slice(0, 120)}
What they do / who they serve: ${args.about.slice(0, 800)}
The vibe they want: ${args.vibe.slice(0, 300)}

Rules:
- palette: 4 hex colors (#rrggbb). primary = structural brand color; accent = warm CTA/donate color with good contrast on white; ink = near-black with a hint of the brand; bg = near-white warm page background. Never pure #000000/#ffffff.
- typography: one pairing key. ${Object.entries(FONT_PAIRS).map(([k, v]) => `"${k}" (${v.label})`).join("; ")}.
- theme: one site design language. ${Object.entries(SITE_THEMES).map(([k, v]) => `"${k}" (${v.blurb})`).join("; ")}.
- wordmark: font key from ${Object.keys(WORDMARK_FONTS).join(", ")}; case upper/title/lower; tracking -50..300 (em/1000); weight 400..800.
- tagline: one short warm sentence, no religious language.
- voice: 2 sentences describing their written tone — this will steer ALL their future copy, so make it specific to them, not generic.`;

  const res = await structured<Record<string, unknown>>(env, prompt, schema, 1500, {
    orgId: args.orgId,
    feature: "brand_proposal",
  });
  if (res.error || !res.data) return { error: res.error ?? "No proposal came back." };
  // whitelists + clamps; anything invented falls back to safe defaults
  return { brand: validateBrand({ ...res.data, logo: { kind: "wordmark", imageUrl: null } }) };
}
