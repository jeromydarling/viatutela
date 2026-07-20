/**
 * Cross-shelter adoption alerts — an adopter signs up once ("senior cat,
 * Colorado") and any real shelter on the platform that takes in a match
 * triggers an email. Demand captured forever, no re-searching.
 *
 * Guardrails: 24h cooldown per alert, hard cap per event, demo org never
 * triggers (its animals aren't real), one-click unsubscribe in every email.
 */

import { newId, newToken } from "./ids";
import { sendAppEmail } from "./email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAILS_PER_EVENT = 200;

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const;

export function isUsState(v: string): boolean {
  return (US_STATES as readonly string[]).includes(v);
}

export interface AdoptAlert {
  id: string;
  email: string;
  species: string | null;
  keywords: string | null;
  state: string | null;
  token: string;
  last_notified_at: string | null;
}

export interface AlertAnimal {
  name: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  orgState: string | null;
}

/** Pure matcher: state gate, species gate, then any-keyword-token match. */
export function matchesAlert(alert: Pick<AdoptAlert, "species" | "keywords" | "state">, animal: AlertAnimal): boolean {
  if (alert.state && alert.state !== (animal.orgState ?? "")) return false;
  const species = (alert.species ?? "any").toLowerCase();
  if (species !== "any" && species !== (animal.species ?? "").toLowerCase()) return false;
  const kw = (alert.keywords ?? "").toLowerCase().trim();
  if (!kw) return true;
  const hay = [animal.name, animal.species, animal.breed, animal.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return kw
    .split(/[,\s]+/)
    .filter((t) => t.length > 2)
    .some((t) => hay.includes(t));
}

export async function subscribeAdoptAlert(
  env: Env,
  args: { email: string; species: string; keywords: string; state: string },
): Promise<boolean> {
  const email = args.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return false;
  const species = args.species.trim().toLowerCase().slice(0, 30) || null;
  const keywords = args.keywords.trim().slice(0, 200) || null;
  const state = isUsState(args.state.trim().toUpperCase()) ? args.state.trim().toUpperCase() : null;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO adopt_alerts (id, email, species, keywords, state, token) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(newId("aa"), email, species === "any" ? null : species, keywords, state, newToken())
    .run();
  return true;
}

/** Fire alerts for a newly public, available animal. Never throws. */
export async function notifyAdoptAlerts(env: Env, orgId: string, animalId: string, origin: string): Promise<void> {
  try {
    const row = await env.DB.prepare(
      `SELECT a.name, a.species, a.breed, a.description, a.status, a.is_public,
              o.name org_name, o.slug org_slug, o.state org_state, o.demo
       FROM animals a JOIN orgs o ON o.id = a.org_id WHERE a.id = ? AND a.org_id = ?`,
    )
      .bind(animalId, orgId)
      .first<Record<string, unknown>>();
    if (!row || !row.is_public || row.demo || row.status !== "available") return;

    const animal: AlertAnimal = {
      name: String(row.name),
      species: row.species ? String(row.species) : null,
      breed: row.breed ? String(row.breed) : null,
      description: row.description ? String(row.description) : null,
      orgState: row.org_state ? String(row.org_state) : null,
    };

    // pre-filter in SQL (state + species + cooldown), keyword-match in code
    const candidates = await env.DB.prepare(
      `SELECT id, email, species, keywords, state, token, last_notified_at FROM adopt_alerts
       WHERE (state IS NULL OR state = ?)
         AND (species IS NULL OR species = lower(coalesce(?, '')))
         AND (last_notified_at IS NULL OR last_notified_at <= datetime('now', '-1 day'))
       LIMIT 1000`,
    )
      .bind(animal.orgState ?? "", animal.species ?? "")
      .all<AdoptAlert>();

    const matched = candidates.results.filter((a) => matchesAlert(a, animal)).slice(0, MAX_EMAILS_PER_EVENT);
    for (const alert of matched) {
      await sendAppEmail(env, {
        to: alert.email,
        subject: `${animal.name} just arrived — your adoption alert 🐾`,
        heading: `Meet ${animal.name}`,
        paragraphs: [
          `${animal.name}${animal.breed ? ` (${animal.breed})` : ""} was just listed by ${String(row.org_name)} — a match for your adoption alert.`,
          `See their photos and story, and reach out before someone else falls in love: ${origin}/adopt/${String(row.org_slug)}/${animalId}`,
          `No longer looking? Unsubscribe any time: ${origin}/find/unsubscribe/${alert.token}`,
        ],
      });
      await env.DB.prepare(`UPDATE adopt_alerts SET last_notified_at = datetime('now') WHERE id = ?`)
        .bind(alert.id)
        .run();
    }
  } catch (err) {
    console.log(`[adopt alerts] ${err instanceof Error ? err.message : err}`);
  }
}
