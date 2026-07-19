/**
 * Vision helpers — intake photos → draft profile, and paper vet
 * records → structured medical rows. Same rules as everything else:
 * server-side, degrade without a key, drafts only (staff review before
 * anything is saved), audit-logged by callers.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, AI_UNAVAILABLE, MODEL } from "./ai";
import { recordAiUsage } from "./ai-shelter";

export interface VisionImage {
  media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string; // base64
}

export async function fileToVisionImage(file: File): Promise<VisionImage | null> {
  const type = file.type;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) return null;
  if (file.size > 5 * 1024 * 1024) return null;
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return { media_type: type as VisionImage["media_type"], data: btoa(bin) };
}

async function visionStructured<T>(
  env: Env,
  args: { orgId: string; feature: string; prompt: string; images: VisionImage[]; schema: Record<string, unknown>; maxTokens: number },
): Promise<{ data?: T; error?: string }> {
  const client = getAnthropic(env);
  if (!client) return { error: AI_UNAVAILABLE };
  try {
    const content: Anthropic.ContentBlockParam[] = [
      ...args.images.map((img) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.media_type, data: img.data },
      })),
      { type: "text" as const, text: args.prompt },
    ];
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: args.maxTokens,
      output_config: { format: { type: "json_schema", schema: args.schema } },
      messages: [{ role: "user", content }],
    });
    await recordAiUsage(env, args.orgId, args.feature, response.usage);
    if (response.stop_reason === "refusal") return { error: "The AI declined that one." };
    const out = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!out?.text) return { error: "The AI came back empty — try again." };
    return { data: JSON.parse(out.text) as T };
  } catch (err) {
    console.log(`[ai vision failed] ${err instanceof Error ? err.message : err}`);
    return { error: "The AI hit a snag — try again in a moment." };
  }
}

export interface IntakeDraft {
  species: string;
  breed_guess: string;
  color: string;
  estimated_age: string;
  sex_guess: string;
  weight_guess: string;
  suggested_name: string;
  bio: string;
}

/** Intake photos → a draft profile staff review before saving. */
export async function draftFromPhotos(
  env: Env,
  args: { orgId: string; images: VisionImage[]; notes: string },
): Promise<{ draft?: IntakeDraft; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      species: { type: "string" },
      breed_guess: { type: "string" },
      color: { type: "string" },
      estimated_age: { type: "string" },
      sex_guess: { type: "string" },
      weight_guess: { type: "string" },
      suggested_name: { type: "string" },
      bio: { type: "string" },
    },
    required: ["species", "breed_guess", "color", "estimated_age", "sex_guess", "weight_guess", "suggested_name", "bio"],
    additionalProperties: false,
  };
  const prompt = `These are intake photos of an animal arriving at a shelter. Staff notes: ${args.notes.slice(0, 500) || "none"}.

Draft their intake profile. Voice for the bio: warm, plain, joyful — animals are "friends". Be honest about uncertainty: breed_guess like "terrier mix (guess)", estimated_age like "roughly 2-4 years", sex_guess "unknown" if you can't tell (never guess medical facts). species must be a single lowercase word (dog, cat, rabbit…). suggested_name: one friendly name idea if staff haven't named them. bio: 2 short paragraphs from what you can actually SEE — markings, expression, posture — plus the staff notes.`;

  const res = await visionStructured<IntakeDraft>(env, { orgId: args.orgId, feature: "intake_vision", prompt, images: args.images, schema, maxTokens: 1500 });
  if (res.error || !res.data) return { error: res.error ?? "No draft came back." };
  const d = res.data;
  return {
    draft: {
      species: String(d.species ?? "").toLowerCase().slice(0, 30),
      breed_guess: String(d.breed_guess ?? "").slice(0, 80),
      color: String(d.color ?? "").slice(0, 60),
      estimated_age: String(d.estimated_age ?? "").slice(0, 60),
      sex_guess: String(d.sex_guess ?? "").slice(0, 20),
      weight_guess: String(d.weight_guess ?? "").slice(0, 40),
      suggested_name: String(d.suggested_name ?? "").slice(0, 60),
      bio: String(d.bio ?? "").slice(0, 2000),
    },
  };
}

export interface OcrRecord {
  date: string | null;
  type: string;
  description: string;
  vet: string | null;
  due_date: string | null;
}

/** Photographed paper vet records → structured medical rows. */
export async function extractVetRecords(
  env: Env,
  args: { orgId: string; images: VisionImage[] },
): Promise<{ records?: OcrRecord[]; error?: string }> {
  const schema = {
    type: "object",
    properties: {
      records: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: ["string", "null"] },
            type: { type: "string" },
            description: { type: "string" },
            vet: { type: ["string", "null"] },
            due_date: { type: ["string", "null"] },
          },
          required: ["date", "type", "description", "vet", "due_date"],
          additionalProperties: false,
        },
      },
    },
    required: ["records"],
    additionalProperties: false,
  };
  const prompt = `These are photographs of paper veterinary records that came with a shelter animal. Extract every distinct medical event you can actually read into rows:
- date: ISO yyyy-mm-dd if legible, else null (NEVER invent dates)
- type: one of vaccine, exam, surgery, treatment, test, note
- description: what happened, including product names exactly as written (e.g. "DHPP - Nobivac lot 4471A")
- vet: clinic or veterinarian name if shown, else null
- due_date: ISO date if the record shows a next-due/expiry, else null
Transcribe faithfully — if handwriting is illegible, write "[illegible]" for the unclear part rather than guessing. Skip non-medical content entirely.`;

  const res = await visionStructured<{ records: OcrRecord[] }>(env, { orgId: args.orgId, feature: "vet_ocr", prompt, images: args.images, schema, maxTokens: 3000 });
  if (res.error || !res.data) return { error: res.error ?? "Nothing came back." };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return {
    records: (res.data.records ?? []).slice(0, 40).map((r) => ({
      date: r.date && iso.test(r.date) ? r.date : null,
      type: String(r.type ?? "note").slice(0, 30),
      description: String(r.description ?? "").slice(0, 500),
      vet: r.vet ? String(r.vet).slice(0, 120) : null,
      due_date: r.due_date && iso.test(r.due_date) ? r.due_date : null,
    })),
  };
}
