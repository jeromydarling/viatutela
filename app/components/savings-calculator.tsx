import { useMemo, useState } from "react";
import { monthlyCostCents, recommendPlan, PLANS } from "../../workers/lib/pricing";

/**
 * Interactive savings calculator.
 * Defaults bake in the mid-size shelter example: ~40 adoptions/month,
 * a stitched stack of per-adoption fees + separate foster & donor tools.
 * Tier recommendation = cheapest for the volume (Starter $9 + $1/adoption
 * beats the $39 flat tier until ~30 adoptions/month).
 */

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function SavingsCalculator() {
  const [adoptions, setAdoptions] = useState(40);
  const [perAdoptionFee, setPerAdoptionFee] = useState(2);
  const [otherToolsMonthly, setOtherToolsMonthly] = useState(190);

  const result = useMemo(() => {
    const currentAnnual = adoptions * 12 * perAdoptionFee + otherToolsMonthly * 12;
    const plan = recommendPlan(adoptions);
    const viaTutelaAnnual = (monthlyCostCents(plan.key, adoptions) * 12) / 100;
    const savings = Math.max(0, currentAnnual - viaTutelaAnnual);
    const tierName =
      plan.key === "starter"
        ? `Starter ($9 + $1 × ${adoptions} adoptions)`
        : `${plan.label} ($${plan.monthlyCents / 100}/mo flat)`;
    return { currentAnnual, viaTutelaAnnual, savings, tierName, plan };
  }, [adoptions, perAdoptionFee, otherToolsMonthly]);

  return (
    <div className="grid md:grid-cols-2 gap-8 items-center">
      <div className="space-y-6">
        <label className="block">
          <span className="font-semibold">Adoptions per month: {adoptions}</span>
          <input
            type="range"
            min={1}
            max={200}
            value={adoptions}
            onChange={(e) => setAdoptions(+e.target.value)}
            className="w-full mt-2 accent-[#4caf7d]"
          />
        </label>
        <label className="block">
          <span className="font-semibold">
            What you pay per adoption today: {fmt(perAdoptionFee)}
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={perAdoptionFee}
            onChange={(e) => setPerAdoptionFee(+e.target.value)}
            className="w-full mt-2 accent-[#4caf7d]"
          />
          <span className="text-sm text-charcoal-soft">e.g. Shelterluv charges $2 per adoption</span>
        </label>
        <label className="block">
          <span className="font-semibold">
            Other tools per month (foster, donor CRM, email): {fmt(otherToolsMonthly)}
          </span>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={otherToolsMonthly}
            onChange={(e) => setOtherToolsMonthly(+e.target.value)}
            className="w-full mt-2 accent-[#4caf7d]"
          />
          <span className="text-sm text-charcoal-soft">
            e.g. Doobert Pro ~$149 + donor CRM ~$40
          </span>
        </label>
      </div>

      <div className="rounded-blob bg-white shadow-soft p-8 text-center space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-cream p-4">
            <div className="text-sm font-semibold text-charcoal-soft">Your stack today</div>
            <div className="text-2xl font-display font-semibold text-terracotta-deep">
              {fmt(result.currentAnnual)}/yr
            </div>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <div className="text-sm font-semibold text-charcoal-soft">{result.tierName}</div>
            <div className="text-2xl font-display font-semibold text-meadow-deep">
              {fmt(result.viaTutelaAnnual)}/yr
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-sunflower p-6">
          <div className="font-semibold">You could put back into the animals</div>
          <div className="text-4xl font-display font-bold">{fmt(result.savings)}</div>
          <div className="text-sm font-semibold">every year</div>
        </div>
        <p className="text-sm text-charcoal-soft">
          {result.plan.key === "starter"
            ? `At your volume, Starter is the cheapest way in — and if you ever pass ~${(PLANS.rescue.monthlyCents - PLANS.starter.monthlyCents) / PLANS.starter.perAdoptionCents} adoptions a month, the flat $39 tier takes over automatically in this math. Never a cut of your donations.`
            : "At your volume the flat tier wins — unlimited adoptions, one predictable bill, never a cut of your donations."}
        </p>
      </div>
    </div>
  );
}
