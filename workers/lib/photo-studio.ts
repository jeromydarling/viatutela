/**
 * Photo studio — AI-suggested, human-approved photo enhancement.
 *
 * The rules that make this trustworthy:
 * - Every adjustment is clamped into whitelisted ranges server-side; the
 *   AI proposes values, it never picks the ranges.
 * - Non-destructive: the original upload stays in R2 untouched. Accepting
 *   an enhancement swaps animal_photos.r2_key to a derivative and parks
 *   the original in original_key; revert swaps back.
 * - Nothing applies without a human tapping accept, and every AI write is
 *   audit-logged by the caller.
 * - Enhance what the camera captured, never fabricate what it didn't:
 *   tone/sharpness/crop only. No generative edits.
 */

import { checkAiBudget } from "./ai-shelter";
import { visionStructured, type VisionImage } from "./ai-vision";

// ---------- whitelisted adjustment ranges (pure, tested) ----------

export const ADJUST_RANGES = {
  brightness: { min: 0.5, max: 1.8, noop: 1 },
  contrast: { min: 0.5, max: 1.8, noop: 1 },
  gamma: { min: 0.5, max: 1.8, noop: 1 },
  saturation: { min: 0, max: 2, noop: 1 },
  sharpen: { min: 0, max: 10, noop: 0 },
} as const;

export type AdjustKey = keyof typeof ADJUST_RANGES;
export type Adjustments = Partial<Record<AdjustKey, number>>;

/** Whitelist keys, clamp into range, round to 2dp, drop no-ops. */
export function clampAdjustments(raw: unknown): Adjustments {
  const out: Adjustments = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of Object.keys(ADJUST_RANGES) as AdjustKey[]) {
    const v = (raw as Record<string, unknown>)[key];
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    const { min, max, noop } = ADJUST_RANGES[key];
    const clamped = Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
    if (clamped !== noop) out[key] = clamped;
  }
  return out;
}

export function isNoop(adj: Adjustments): boolean {
  return Object.keys(adj).length === 0;
}

/** "brightness ×1.15 · sharpen 3" — for audit logs and the UI. */
export function describeAdjustments(adj: Adjustments): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(adj)) {
    parts.push(k === "sharpen" ? `${k} ${v}` : `${k} ×${v}`);
  }
  return parts.join(" · ") || "no changes";
}

/** Clamp a focal point into the unit square; default to face-ish center. */
export function clampFocal(x: unknown, y: unknown): { x: number; y: number } {
  const fx = Number(x);
  const fy = Number(y);
  return {
    x: Number.isFinite(fx) ? Math.round(Math.min(1, Math.max(0, fx)) * 100) / 100 : 0.5,
    y: Number.isFinite(fy) ? Math.round(Math.min(1, Math.max(0, fy)) * 100) / 100 : 0.4,
  };
}

export const SOCIAL_CROPS = [
  { label: "Square (feed posts)", suffix: "sq", width: 1080, height: 1080 },
  { label: "Portrait (stories & reels)", suffix: "tall", width: 1080, height: 1350 },
  { label: "Wide (link previews)", suffix: "wide", width: 1200, height: 675 },
] as const;

// ---------- R2 ↔ Images plumbing ----------

/**
 * Fetch a photo from R2 downscaled for vision (smaller tokens, under the
 * API's per-image cap). Falls back to raw bytes when the Images binding
 * is unavailable (local dev).
 */
export async function r2ToVisionImage(env: Env, key: string): Promise<VisionImage | null> {
  const obj = await env.MEDIA.get(key);
  if (!obj) return null;
  try {
    const result = await env.IMAGES.input(obj.body)
      .transform({ width: 900, fit: "scale-down" })
      .output({ format: "image/jpeg", quality: 80 });
    const bytes = new Uint8Array(await new Response(result.image()).arrayBuffer());
    return { media_type: "image/jpeg", data: bytesToBase64(bytes) };
  } catch {
    const raw = await env.MEDIA.get(key);
    if (!raw) return null;
    const type = raw.httpMetadata?.contentType ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) return null;
    const bytes = new Uint8Array(await raw.arrayBuffer());
    if (bytes.length > 4_500_000) return null;
    return { media_type: type as VisionImage["media_type"], data: bytesToBase64(bytes) };
  }
}

function bytesToBase64(buf: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Apply clamped adjustments to srcKey, write a JPEG derivative at destKey. */
export async function applyAdjustments(
  env: Env,
  srcKey: string,
  destKey: string,
  adj: Adjustments,
): Promise<boolean> {
  const obj = await env.MEDIA.get(srcKey);
  if (!obj) return false;
  try {
    const result = await env.IMAGES.input(obj.body)
      .transform({ ...adj })
      .output({ format: "image/jpeg", quality: 88 });
    await env.MEDIA.put(destKey, result.image(), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    return true;
  } catch (err) {
    console.log(`[photo enhance failed] ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/** Cut the three social crops around a focal point; returns stored keys. */
export async function makeSocialCrops(
  env: Env,
  srcKey: string,
  destPrefix: string,
  focal: { x: number; y: number },
): Promise<{ label: string; key: string }[]> {
  const out: { label: string; key: string }[] = [];
  for (const crop of SOCIAL_CROPS) {
    const obj = await env.MEDIA.get(srcKey);
    if (!obj) break;
    try {
      const result = await env.IMAGES.input(obj.body)
        .transform({
          width: crop.width,
          height: crop.height,
          fit: "cover",
          gravity: { x: focal.x, y: focal.y, mode: "box-center" },
        })
        .output({ format: "image/jpeg", quality: 88 });
      const key = `${destPrefix}-${crop.suffix}.jpg`;
      await env.MEDIA.put(key, result.image(), { httpMetadata: { contentType: "image/jpeg" } });
      out.push({ label: crop.label, key });
    } catch (err) {
      console.log(`[photo crop failed] ${err instanceof Error ? err.message : err}`);
      break;
    }
  }
  return out;
}

// ---------- AI suggestions (vision, Claude-only, budget-gated) ----------

export interface EnhanceSuggestion {
  adjustments: Adjustments;
  rationale: string;
  alt_text: string;
  focal: { x: number; y: number };
}

const ENHANCE_SCHEMA = {
  type: "object",
  properties: {
    brightness: { type: "number" },
    contrast: { type: "number" },
    gamma: { type: "number" },
    saturation: { type: "number" },
    sharpen: { type: "number" },
    rationale: { type: "string" },
    alt_text: { type: "string" },
    focal_x: { type: "number" },
    focal_y: { type: "number" },
  },
  required: ["brightness", "contrast", "gamma", "saturation", "sharpen", "rationale", "alt_text", "focal_x", "focal_y"],
  additionalProperties: false,
};

/** Look at one photo and propose gentle, natural adjustments. */
export async function suggestEnhancement(
  env: Env,
  args: { orgId: string; image: VisionImage },
): Promise<{ suggestion?: EnhanceSuggestion; error?: string }> {
  const budget = await checkAiBudget(env, args.orgId);
  if (!budget.ok) return { error: budget.error };
  const prompt = `This is an adoption-listing photo of a shelter animal. Suggest GENTLE tonal adjustments that make the animal easier to see and the photo warmer, while keeping it natural and honest — adopters must meet the same animal they saw.

Multipliers where 1 = unchanged: brightness (0.5–1.8), contrast (0.5–1.8), gamma (0.5–1.8), saturation (0–2). sharpen is 0–10 where 0 = none. Typical good fixes are small: a dim kennel shot might be brightness 1.2, gamma 1.1, sharpen 2. If the photo already looks good, return 1,1,1,1,0 — do not invent changes.

rationale: one warm sentence for shelter staff about what you'd nudge and why (or why it's already lovely).
alt_text: one plain factual sentence describing the animal for screen readers (no marketing).
focal_x / focal_y: the animal's face position as fractions of width/height from top-left.`;

  const res = await visionStructured<Record<string, unknown>>(env, {
    orgId: args.orgId,
    feature: "photo_enhance",
    prompt,
    images: [args.image],
    schema: ENHANCE_SCHEMA,
    maxTokens: 500,
  });
  if (res.error || !res.data) return { error: res.error ?? "No suggestion came back." };
  const d = res.data;
  return {
    suggestion: {
      adjustments: clampAdjustments(d),
      rationale: String(d.rationale ?? "").slice(0, 300),
      alt_text: String(d.alt_text ?? "").slice(0, 250),
      focal: clampFocal(d.focal_x, d.focal_y),
    },
  };
}

export interface PhotoReview {
  index: number;
  score: number;
  tip: string;
  alt_text: string;
}

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    best_index: { type: "integer" },
    reviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          score: { type: "integer" },
          tip: { type: "string" },
          alt_text: { type: "string" },
        },
        required: ["index", "score", "tip", "alt_text"],
        additionalProperties: false,
      },
    },
  },
  required: ["best_index", "reviews"],
  additionalProperties: false,
};

/** Score a set of photos and pick the one that should lead. */
export async function reviewPhotos(
  env: Env,
  args: { orgId: string; images: VisionImage[] },
): Promise<{ bestIndex?: number; reviews?: PhotoReview[]; error?: string }> {
  const budget = await checkAiBudget(env, args.orgId);
  if (!budget.ok) return { error: budget.error };
  const prompt = `These are the ${args.images.length} listing photos for one shelter animal, numbered 1 to ${args.images.length} in the order shown. As an adoption-photo coach:

For each photo: score 0–100 (sharp focus, good light, animal's face visible, engaging expression, uncluttered background), a tip — one short warm sentence: either what makes it work or one concrete retake suggestion (e.g. "shoot at their eye level near a window") — and alt_text, one plain factual sentence for screen readers.

best_index: the number of the photo that should lead the adoption page — the one that would make someone stop scrolling. Score what you actually see; be honest, not flattering.`;

  const res = await visionStructured<{ best_index: number; reviews: PhotoReview[] }>(env, {
    orgId: args.orgId,
    feature: "photo_review",
    prompt,
    images: args.images,
    schema: REVIEW_SCHEMA,
    maxTokens: 1200,
  });
  if (res.error || !res.data) return { error: res.error ?? "No review came back." };
  const n = args.images.length;
  const clampIdx = (v: unknown) => Math.min(n, Math.max(1, Math.round(Number(v)) || 1));
  return {
    bestIndex: clampIdx(res.data.best_index),
    reviews: (res.data.reviews ?? []).slice(0, n).map((r) => ({
      index: clampIdx(r.index),
      score: Math.min(100, Math.max(0, Math.round(Number(r.score)) || 0)),
      tip: String(r.tip ?? "").slice(0, 250),
      alt_text: String(r.alt_text ?? "").slice(0, 250),
    })),
  };
}
