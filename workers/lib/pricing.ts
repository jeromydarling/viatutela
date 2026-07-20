/**
 * Pricing — the single source of truth. Every surface (pricing cards,
 * savings calculator, comparison chart, billing) reads from here.
 * Money is integer cents, always.
 */

export interface Plan {
  key: string;
  label: string;
  monthlyCents: number;
  perAdoptionCents: number; // 0 = flat tier
  seats: number; // team members allowed (marketing: Starter promises 2)
}

export const PLANS: Record<string, Plan> = {
  starter: { key: "starter", label: "Starter", monthlyCents: 900, perAdoptionCents: 100, seats: 2 },
  rescue: { key: "rescue", label: "Rescue", monthlyCents: 3900, perAdoptionCents: 0, seats: 10 },
  pro: { key: "pro", label: "Shelter Pro", monthlyCents: 7900, perAdoptionCents: 0, seats: 25 },
};

/**
 * Starter's per-adoption fees stop accruing once they'd exceed the gap
 * to the flat Rescue tier — "you'll never pay more than flat pricing."
 * The cap is derived, not hardcoded: $39 − $9 = $30 = 30 adoptions.
 */
export const STARTER_USAGE_CAP_CENTS = PLANS.rescue.monthlyCents - PLANS.starter.monthlyCents;

/** The charge for the next adoption given what's already billed this month. */
export function nextUsageChargeCents(billedThisMonthCents: number): number {
  const remaining = STARTER_USAGE_CAP_CENTS - billedThisMonthCents;
  return Math.max(0, Math.min(PLANS.starter.perAdoptionCents, remaining));
}

export function seatLimit(planKey: string): number {
  return (PLANS[planKey] ?? PLANS.starter).seats;
}

/** What a month costs on a plan at a given adoption volume, in cents. */
export function monthlyCostCents(planKey: string, adoptionsPerMonth: number): number {
  const plan = PLANS[planKey] ?? PLANS.starter;
  return plan.monthlyCents + plan.perAdoptionCents * Math.max(0, Math.round(adoptionsPerMonth));
}

/**
 * Cheapest tier for a volume. Starter ($9 + $1×a) beats Rescue ($39 flat)
 * until a ≥ 30 (9 + 30 = 39) — at the crossover we recommend the flat
 * tier, since it only gets better from there.
 */
export function recommendPlan(adoptionsPerMonth: number): Plan {
  const a = Math.max(0, Math.round(adoptionsPerMonth));
  return monthlyCostCents("starter", a) < PLANS.rescue.monthlyCents ? PLANS.starter : PLANS.rescue;
}

export function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
