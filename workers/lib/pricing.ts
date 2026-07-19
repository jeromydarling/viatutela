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
}

export const PLANS: Record<string, Plan> = {
  starter: { key: "starter", label: "Starter", monthlyCents: 900, perAdoptionCents: 100 },
  rescue: { key: "rescue", label: "Rescue", monthlyCents: 3900, perAdoptionCents: 0 },
  pro: { key: "pro", label: "Shelter Pro", monthlyCents: 7900, perAdoptionCents: 0 },
};

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
