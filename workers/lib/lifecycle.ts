/**
 * Post-adoption lifecycle — day-3 / week-2 / month-6 check-ins and a
 * yearly "gotcha day" note. Scheduled when an adoption is recorded,
 * drained by the daily cron, suppression-aware, unsubscribe on every
 * send. Catches problems before they become returns, and quietly turns
 * adopters into lifelong supporters.
 */

import { newId } from "./ids";
import { sendAppEmail } from "./email";
import { makeUnsubToken } from "./supporter-email";

/** Pure: which follow-ups an adoption generates. */
export function followupPlan(): { kind: string; days: number }[] {
  return [
    { kind: "day3", days: 3 },
    { kind: "week2", days: 14 },
    { kind: "month6", days: 183 },
    { kind: "gotcha_day", days: 365 },
  ];
}

/** Fired (waitUntil) after an adoption is recorded. Idempotent per adoption. */
export async function scheduleFollowups(env: Env, orgId: string, adoptionId: string): Promise<void> {
  try {
    const existing = await env.DB.prepare(`SELECT id FROM followups WHERE adoption_id = ? LIMIT 1`).bind(adoptionId).first();
    if (existing) return;
    const row = await env.DB.prepare(
      `SELECT ad.id, ad.animal_id, a.name animal_name, c.email, c.name adopter_name
       FROM adoptions ad JOIN animals a ON a.id = ad.animal_id
       LEFT JOIN contacts c ON c.id = ad.contact_id
       WHERE ad.id = ? AND ad.org_id = ?`,
    )
      .bind(adoptionId, orgId)
      .first<{ id: string; animal_id: string; animal_name: string; email: string | null; adopter_name: string | null }>();
    if (!row?.email) return; // no adopter email — nothing to schedule
    const stmts = followupPlan().map(({ kind, days }) =>
      env.DB.prepare(
        `INSERT INTO followups (id, org_id, adoption_id, animal_id, email, adopter_name, animal_name, kind, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', '+${days} days'))`,
      ).bind(newId("fu"), orgId, adoptionId, row.animal_id, row.email, row.adopter_name, row.animal_name, kind),
    );
    await env.DB.batch(stmts);
  } catch (err) {
    console.log(`[followup schedule failed] ${err instanceof Error ? err.message : err}`);
  }
}

function followupCopy(kind: string, adopter: string, animal: string, siteUrl: string): { subject: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string } } {
  switch (kind) {
    case "day3":
      return {
        subject: `How are the first days with ${animal}? 🐾`,
        heading: `Three days in — how's ${animal} settling?`,
        paragraphs: [
          `${adopter}, the first days are the wobbliest — hiding, skipped meals, and 3am zoomies are all completely normal.`,
          `If anything has you worried, just reply to this email. We'd always rather answer a small question than a big one later.`,
        ],
      };
    case "week2":
      return {
        subject: `Two weeks with ${animal} — we'd love a photo`,
        heading: `${animal} is probably running the house by now`,
        paragraphs: [
          `${adopter}, by two weeks most friends have claimed a favorite spot and at least one human heart.`,
          `If you snap a photo, send it our way (just reply) — happy updates are the fuel this work runs on, and we'd love to celebrate ${animal} with our community.`,
        ],
      };
    case "month6":
      return {
        subject: `Six months of ${animal} 💛`,
        heading: `Half a year already`,
        paragraphs: [
          `${adopter}, we still think about ${animal} — alumni are family here.`,
          `If your home is full of one happy animal and you've got a little room in your heart for the ones still waiting, a small gift or a shared post goes further than you'd think. No pressure, ever.`,
        ],
        cta: { label: "Visit the rescue", url: siteUrl },
      };
    default:
      return {
        subject: `Happy Gotcha Day, ${animal}! 🎉`,
        heading: `One year ago today, ${animal} picked you`,
        paragraphs: [
          `${adopter}, happy Gotcha Day to you both — this anniversary is one of our favorite things to celebrate.`,
          `If you'd like to mark the day, a birthday-sized gift to the rescue helps the next friend find their own gotcha day.`,
        ],
        cta: { label: "Celebrate with a gift", url: siteUrl },
      };
  }
}

/** Daily cron: send everything due; gotcha days re-arm for next year. */
export async function processFollowups(env: Env, appOrigin: string): Promise<void> {
  try {
    const due = await env.DB.prepare(
      `SELECT f.*, o.name org_name, o.slug, o.email org_email, o.custom_domain
       FROM followups f JOIN orgs o ON o.id = f.org_id
       WHERE f.sent_at IS NULL AND f.due_date <= date('now') LIMIT 100`,
    ).all<Record<string, unknown>>();

    for (const f of due.results) {
      const orgId = String(f.org_id);
      const email = String(f.email);
      const suppressed = await env.DB.prepare(`SELECT email FROM email_suppression WHERE org_id = ? AND email = ?`)
        .bind(orgId, email)
        .first();
      if (!suppressed) {
        const siteUrl = f.custom_domain ? `https://${f.custom_domain}` : `${appOrigin}/s/${f.slug}`;
        const copy = followupCopy(String(f.kind), String(f.adopter_name ?? "Friend"), String(f.animal_name ?? "your friend"), siteUrl);
        const unsub = `${appOrigin}/unsub/${await makeUnsubToken(env, orgId, email)}`;
        await sendAppEmail(env, {
          to: email,
          subject: copy.subject,
          heading: copy.heading,
          paragraphs: [...copy.paragraphs, `— ${String(f.org_name)} · unsubscribe: ${unsub}`],
          ...(copy.cta ? { cta: copy.cta } : {}),
          ...(f.org_email ? { replyTo: String(f.org_email) } : {}),
          headers: { "List-Unsubscribe": `<${unsub}>` },
        });
      }
      await env.DB.prepare(`UPDATE followups SET sent_at = datetime('now') WHERE id = ?`).bind(f.id).run();
      if (String(f.kind) === "gotcha_day") {
        await env.DB.prepare(
          `INSERT INTO followups (id, org_id, adoption_id, animal_id, email, adopter_name, animal_name, kind, due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'gotcha_day', date(?, '+365 days'))`,
        )
          .bind(newId("fu"), orgId, f.adoption_id, f.animal_id, email, f.adopter_name, f.animal_name, f.due_date)
          .run();
      }
    }
  } catch (err) {
    console.log(`[followups failed] ${err instanceof Error ? err.message : err}`);
  }
}
