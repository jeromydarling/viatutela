/**
 * Internal product-usage telemetry — separate from the tracking.ts module,
 * which is customer-facing (shelters' OWN GA4/Meta Pixel IDs on their
 * public sites). This is ours: a lightweight log of which app screens
 * orgs actually reach, so churn stops being a mystery.
 *
 * Fire-and-forget (waitUntil), never throws, never blocks a request. Not
 * for anything sensitive — no message bodies, no PII beyond ids the org
 * already controls.
 */

import { newId } from "./ids";

export async function trackEvent(
  env: Env,
  args: { orgId: string | null; userId?: string | null; event: string; path?: string | null; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO product_events (id, org_id, user_id, event, path, meta) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId("pe"),
        args.orgId,
        args.userId ?? null,
        args.event.slice(0, 60),
        args.path ? args.path.slice(0, 200) : null,
        args.meta ? JSON.stringify(args.meta).slice(0, 2000) : null,
      )
      .run();
  } catch (err) {
    console.log(`[telemetry failed] ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Record a milestone exactly once per org (e.g. "first_animal"). Cheap
 * existence check first — milestones fire rarely, so the extra read is
 * negligible next to the value of knowing WHEN an org crossed each one.
 */
export async function trackMilestone(env: Env, orgId: string, event: string): Promise<void> {
  try {
    const existing = await env.DB.prepare(
      `SELECT 1 FROM product_events WHERE org_id = ? AND event = ? LIMIT 1`,
    )
      .bind(orgId, event)
      .first();
    if (existing) return;
    await trackEvent(env, { orgId, event });
  } catch (err) {
    console.log(`[telemetry milestone failed] ${err instanceof Error ? err.message : err}`);
  }
}
