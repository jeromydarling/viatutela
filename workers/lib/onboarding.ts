/**
 * New-org onboarding: a workspace that's alive on first login, and a
 * warm three-email drip (day 1 / 3 / 7) drained by the daily cron.
 * Suppression-aware, unsubscribe on every send — same manners as all
 * our mail.
 */

import { newId } from "./ids";
import { sendAppEmail } from "./email";
import { makeUnsubToken } from "./supporter-email";
import { createStarterPages } from "./site-starters";

/** Pure: the drip plan. */
export function onboardingPlan(): { kind: string; days: number }[] {
  return [
    { kind: "day1", days: 1 },
    { kind: "day3", days: 3 },
    { kind: "day7", days: 7 },
  ];
}

const STARTER_TASKS = [
  "Add your first friend (Animals → Add, or snap intake photos and let AI draft the profile)",
  "Make it yours in the Brand Studio — colors, wordmark, and a site theme",
  "Open your website pages and publish the ones you like (they're drafted and waiting)",
  "Share your adoption page link — it's live the moment a friend is",
];

/**
 * Called once at signup (waitUntil): starter website drafts + a warm
 * to-do list + the email drip. Nothing here can fail signup — best effort.
 */
export async function seedNewOrg(
  env: Env,
  args: { orgId: string; orgName: string; slug: string; email: string; name: string | null },
): Promise<void> {
  const appOrigin = (env as unknown as { APP_ORIGIN?: string }).APP_ORIGIN ?? "https://viatutela.pet";
  try {
    await createStarterPages(env, args.orgId, args.orgName, args.slug);
    const stmts = STARTER_TASKS.map((title, i) =>
      env.DB.prepare(`INSERT INTO tasks (id, org_id, title, due_date) VALUES (?, ?, ?, date('now', '+${i + 1} days'))`)
        .bind(newId("tk"), args.orgId, title),
    );
    for (const { kind, days } of onboardingPlan()) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO onboarding_emails (id, org_id, email, name, kind, due_date) VALUES (?, ?, ?, ?, ?, date('now', '+${days} days'))`,
        ).bind(newId("ob"), args.orgId, args.email, args.name, kind),
      );
    }
    await env.DB.batch(stmts);
    // an immediate hello — the drip picks up from day 1
    await sendAppEmail(env, {
      to: args.email,
      subject: `Welcome to Tutela, ${args.orgName} 🌻`,
      heading: `Your workspace is ready`,
      paragraphs: [
        `Hi${args.name ? ` ${args.name}` : ""} — ${args.orgName} is all set up on Tutela.`,
        "We've drafted starter website pages and a getting-settled checklist so the nest is never empty. Sign in whenever you're ready and make it yours.",
        "Coming from other software? The free importer brings every animal, adopter, and record over with their relationships intact — no re-typing.",
      ],
      cta: { label: "Open your workspace", url: `${appOrigin}/app` },
    });
  } catch (err) {
    console.log(`[seed new org failed] ${err instanceof Error ? err.message : err}`);
  }
}

function onboardingCopy(
  kind: string,
  name: string,
  orgName: string,
  origin: string,
): { subject: string; heading: string; paragraphs: string[]; cta: { label: string; url: string } } {
  switch (kind) {
    case "day1":
      return {
        subject: `Your first 10 minutes with Tutela 🌻`,
        heading: `Welcome, ${name} — the nest is ready`,
        paragraphs: [
          `${orgName} already has a website drafted (really — six pages, waiting in Website), and a short to-do list on your dashboard walks you through the rest.`,
          `The fastest way to feel it click: add one animal. Snap a few photos and the AI drafts the profile; flip "Publish to site" and they're on your website, adoption page, and Petfinder feed at once.`,
          `Stuck on anything at all? Just reply to this email — a human reads these.`,
        ],
        cta: { label: "Open your dashboard", url: `${origin}/app` },
      };
    case "day3":
      return {
        subject: `The three features shelters say they'd fight for`,
        heading: `Now that you've settled in…`,
        paragraphs: [
          `A few things easy to miss: every animal page has a share bar and a print-ready flyer (volunteers love these). The Applications inbox has an ✨ AI review button that scores fit and drafts your reply. And the match quiz on your adoption page points adopters at the right friend before they ever email you.`,
          `Coming from another system? The importer brings every record and relationship over in minutes — bonded pairs included.`,
        ],
        cta: { label: "Try the AI review", url: `${origin}/app/applications` },
      };
    default:
      return {
        subject: `One week in — time to make it official 💛`,
        heading: `A week of ${orgName} on Tutela`,
        paragraphs: [
          `When you're ready to look established: connect your own domain (Website → Domain), pick a site theme in the Brand Studio, and let the Marketing Studio draft your first launch posts — it writes in your voice and never posts without you.`,
          `And when grant season comes, the Grant writer turns your real numbers into a funder-ready draft. Your numbers are already accumulating.`,
          `We're glad you're here. The animals are lucky to have you.`,
        ],
        cta: { label: "Connect your domain", url: `${origin}/app/website/domain` },
      };
  }
}

/** Daily cron: send everything due. */
export async function processOnboardingEmails(env: Env, appOrigin: string): Promise<void> {
  try {
    const due = await env.DB.prepare(
      `SELECT ob.*, o.name org_name FROM onboarding_emails ob JOIN orgs o ON o.id = ob.org_id
       WHERE ob.sent_at IS NULL AND ob.due_date <= date('now') LIMIT 100`,
    ).all<Record<string, unknown>>();
    for (const row of due.results) {
      const orgId = String(row.org_id);
      const email = String(row.email);
      const suppressed = await env.DB.prepare(
        `SELECT email FROM email_suppression WHERE org_id = ? AND email = ?`,
      ).bind(orgId, email).first();
      if (!suppressed) {
        const copy = onboardingCopy(String(row.kind), String(row.name ?? "friend"), String(row.org_name), appOrigin);
        const unsub = `${appOrigin}/unsub/${await makeUnsubToken(env, orgId, email)}`;
        await sendAppEmail(env, {
          to: email,
          subject: copy.subject,
          heading: copy.heading,
          paragraphs: [...copy.paragraphs, `— Tutela · unsubscribe from these tips: ${unsub}`],
          cta: copy.cta,
          headers: { "List-Unsubscribe": `<${unsub}>` },
        });
      }
      await env.DB.prepare(`UPDATE onboarding_emails SET sent_at = datetime('now') WHERE id = ?`).bind(row.id).run();
    }
  } catch (err) {
    console.log(`[onboarding emails failed] ${err instanceof Error ? err.message : err}`);
  }
}
