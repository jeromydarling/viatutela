import { useMemo, useState } from "react";

/**
 * Interactive savings calculator.
 * Defaults bake in the mid-size shelter example: ~40 adoptions/month,
 * a stitched stack of per-adoption fees + separate foster & donor tools.
 */

const TIERS = [
  { name: "Little Nest (Free)", monthly: 0, maxAdoptions: 5 },
  { name: "Rescue", monthly: 39, maxAdoptions: 25 },
  { name: "Shelter Pro", monthly: 79, maxAdoptions: Infinity },
];

function tierFor(adoptionsPerMonth: number) {
  return TIERS.find((t) => adoptionsPerMonth <= t.maxAdoptions) ?? TIERS[TIERS.length - 1];
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function SavingsCalculator() {
  const [adoptions, setAdoptions] = useState(40);
  const [perAdoptionFee, setPerAdoptionFee] = useState(2);
  const [otherToolsMonthly, setOtherToolsMonthly] = useState(190);

  const result = useMemo(() => {
    const currentAnnual = adoptions * 12 * perAdoptionFee + otherToolsMonthly * 12;
    const tier = tierFor(adoptions);
    const viaTutelaAnnual = tier.monthly * 12;
    const savings = Math.max(0, currentAnnual - viaTutelaAnnual);
    return { currentAnnual, viaTutelaAnnual, savings, tier };
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
            <div className="text-sm font-semibold text-charcoal-soft">{result.tier.name}</div>
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
          Flat pricing, no per-adoption fees, no cut of your donations. Ever.
        </p>
      </div>
    </div>
  );
}
