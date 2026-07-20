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
import { nextUsageChargeCents } from "./pricing";

/** Fire (waitUntil) when an adoption is finalized. Never throws, never double-counts.
 * Monthly cap: once Starter usage reaches the flat-tier gap ($30), further
 * adoptions log $0 rows — the ledger still counts every adoption, but the
 * bill can never exceed what Rescue would have cost. */
export async function recordAdoptionUsage(env: Env, orgId: string, adoptionId: string): Promise<void> {
  try {
    const org = await env.DB.prepare(`SELECT plan, demo FROM orgs WHERE id = ?`)
      .bind(orgId)
      .first<{ plan: string; demo: number }>();
    if (!org || org.demo || org.plan !== "starter") return;
    const month = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) c FROM billing_usage
       WHERE org_id = ? AND created_at >= datetime('now', 'start of month')`,
    )
      .bind(orgId)
      .first<{ c: number }>();
    // INSERT OR IGNORE + UNIQUE(adoption_id) = idempotent under re-fires
    await env.DB.prepare(
      `INSERT OR IGNORE INTO billing_usage (id, org_id, adoption_id, amount_cents) VALUES (?, ?, ?, ?)`,
    )
      .bind(newId("bu"), orgId, adoptionId, nextUsageChargeCents(month?.c ?? 0))
      .run();
  } catch (err) {
    console.log(`[adoption usage failed] ${err instanceof Error ? err.message : err}`);
  }
}
