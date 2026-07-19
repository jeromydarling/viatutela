/**
 * Interest waitlist — adopters subscribe to "tell me when you get a
 * senior cat", and the arrival of a matching friend emails them.
 * Notifications respect the suppression table and carry unsubscribe
 * links; each subscription fires at most once (notified_at).
 */

import { newId } from "./ids";
import { sendAppEmail } from "./email";
import { makeUnsubToken } from "./supporter-email";

export interface WaitlistSub {
  id: string;
  email: string;
  name: string | null;
  species: string | null;
  keywords: string | null;
}

export interface WaitlistAnimal {
  name: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  bonded: boolean;
  senior: boolean;
}

/** Pure matcher — species gate plus any-keyword-token match. */
export function matchesSubscription(sub: WaitlistSub, animal: WaitlistAnimal): boolean {
  const species = (sub.species ?? "any").toLowerCase();
  if (species !== "any" && species !== (animal.species ?? "").toLowerCase()) return false;
  const kw = (sub.keywords ?? "").toLowerCase().trim();
  if (!kw) return true;
  const hay = [
    animal.name,
    animal.species,
    animal.breed,
    animal.description,
    animal.bonded ? "bonded pair" : "",
    animal.senior ? "senior older" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return kw
    .split(/[,\s]+/)
    .filter((t) => t.length > 2)
    .some((t) => hay.includes(t));
}

export async function subscribeWaitlist(
  env: Env,
  args: { orgId: string; email: string; name: string; species: string; keywords: string },
): Promise<boolean> {
  const email = args.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return false;
  const existing = await env.DB.prepare(
    `SELECT id FROM waitlist_subscriptions WHERE org_id = ? AND email = ? AND notified_at IS NULL`,
  )
    .bind(args.orgId, email)
    .first();
  if (existing) {
    await env.DB.prepare(
      `UPDATE waitlist_subscriptions SET species = ?, keywords = ?, name = COALESCE(NULLIF(?, ''), name) WHERE id = ?`,
    )
      .bind(args.species.slice(0, 20) || "any", args.keywords.slice(0, 200) || null, args.name.slice(0, 120), (existing as { id: string }).id)
      .run();
    return true;
  }
  await env.DB.prepare(
    `INSERT INTO waitlist_subscriptions (id, org_id, email, name, species, keywords) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(newId("wl"), args.orgId, email, args.name.slice(0, 120) || null, args.species.slice(0, 20) || "any", args.keywords.slice(0, 200) || null)
    .run();
  return true;
}

/** Fired (waitUntil) when a public, available friend is added. */
export async function notifyWaitlist(env: Env, orgId: string, animalId: string, origin: string): Promise<void> {
  try {
    const a = await env.DB.prepare(
      `SELECT name, species, breed, description, bonded_group_id, dob, is_public, status FROM animals WHERE id = ? AND org_id = ?`,
    )
      .bind(animalId, orgId)
      .first<Record<string, unknown>>();
    if (!a || !a.is_public || a.status !== "available") return;
    const senior = typeof a.dob === "string" && a.dob !== "" && Date.parse(a.dob as string) < Date.now() - 7 * 365.25 * 86_400_000;
    const animal: WaitlistAnimal = {
      name: String(a.name),
      species: a.species ? String(a.species) : null,
      breed: a.breed ? String(a.breed) : null,
      description: a.description ? String(a.description) : null,
      bonded: Boolean(a.bonded_group_id),
      senior,
    };
    const org = await env.DB.prepare(`SELECT name, slug, email FROM orgs WHERE id = ?`).bind(orgId).first<{ name: string; slug: string; email: string | null }>();
    if (!org) return;
    const subs = await env.DB.prepare(
      `SELECT id, email, name, species, keywords FROM waitlist_subscriptions WHERE org_id = ? AND notified_at IS NULL LIMIT 200`,
    )
      .bind(orgId)
      .all<WaitlistSub>();
    const sup = await env.DB.prepare(`SELECT email FROM email_suppression WHERE org_id = ?`).bind(orgId).all<{ email: string }>();
    const suppressed = new Set(sup.results.map((r) => r.email));

    let sent = 0;
    for (const sub of subs.results) {
      if (sent >= 50) break;
      if (suppressed.has(sub.email) || !matchesSubscription(sub, animal)) continue;
      const unsub = `${origin}/unsub/${await makeUnsubToken(env, orgId, sub.email)}`;
      await sendAppEmail(env, {
        to: sub.email,
        subject: `${animal.name} just arrived at ${org.name} 💛`,
        heading: `You asked us to tell you — meet ${animal.name}`,
        paragraphs: [
          `${sub.name ?? "Friend"}, a new arrival matches what you're waiting for: ${animal.name}${animal.breed ? ` (${animal.breed})` : ""}.`,
          animal.bonded ? `Heads up: they're part of a bonded pair and go home together.` : `Good matches go quickly — a look costs nothing.`,
          `Not the right fit? No worries — you'll stay on the list for the next arrival. Unsubscribe any time: ${unsub}`,
        ],
        cta: { label: `Meet ${animal.name}`, url: `${origin}/adopt/${org.slug}/${animalId}` },
        ...(org.email ? { replyTo: org.email } : {}),
        headers: { "List-Unsubscribe": `<${unsub}>` },
      });
      await env.DB.prepare(`UPDATE waitlist_subscriptions SET notified_at = datetime('now') WHERE id = ?`).bind(sub.id).run();
      sent++;
    }
  } catch (err) {
    console.log(`[waitlist notify failed] ${err instanceof Error ? err.message : err}`);
  }
}
