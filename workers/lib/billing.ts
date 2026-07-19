/**
 * Usage billing for the Starter tier: $1 per finalized adoption, logged
 * to a local ledger with hard idempotency (UNIQUE adoption_id). When
 * the Stripe integration lands, a sync job pushes unsynced rows as
 * metered usage records and stamps stripe_synced_at — the ledger is the
 * source of truth either way.
 *
 * Flat tiers (rescue/pro) and the demo org never write usage rows.
 */

import { newId } from "./ids";
import { PLANS } from "./pricing";

/** Fire (waitUntil) when an adoption is finalized. Never throws, never double-counts. */
export async function recordAdoptionUsage(env: Env, orgId: string, adoptionId: string): Promise<void> {
  try {
    const org = await env.DB.prepare(`SELECT plan, demo FROM orgs WHERE id = ?`)
      .bind(orgId)
      .first<{ plan: string; demo: number }>();
    if (!org || org.demo || org.plan !== "starter") return;
    // INSERT OR IGNORE + UNIQUE(adoption_id) = idempotent under re-fires
    await env.DB.prepare(
      `INSERT OR IGNORE INTO billing_usage (id, org_id, adoption_id, amount_cents) VALUES (?, ?, ?, ?)`,
    )
      .bind(newId("bu"), orgId, adoptionId, PLANS.starter.perAdoptionCents)
      .run();
  } catch (err) {
    console.log(`[adoption usage failed] ${err instanceof Error ? err.message : err}`);
  }
}
