import { describe, expect, it } from "vitest";
import { PLANS, STARTER_USAGE_CAP_CENTS, nextUsageChargeCents, monthlyCostCents } from "../pricing";

describe("Starter usage cap", () => {
  it("cap equals the gap to the flat tier ($30)", () => {
    expect(STARTER_USAGE_CAP_CENTS).toBe(3000);
    expect(STARTER_USAGE_CAP_CENTS).toBe(PLANS.rescue.monthlyCents - PLANS.starter.monthlyCents);
  });

  it("charges $1 until the cap, then $0", () => {
    expect(nextUsageChargeCents(0)).toBe(100);
    expect(nextUsageChargeCents(2900)).toBe(100); // 30th adoption still bills
    expect(nextUsageChargeCents(3000)).toBe(0); // 31st is free
    expect(nextUsageChargeCents(99_999)).toBe(0);
  });

  it("partial remainder never overbills past the cap", () => {
    expect(nextUsageChargeCents(2950)).toBe(50);
    expect(nextUsageChargeCents(2999)).toBe(1);
  });

  it("a capped Starter month never exceeds Rescue's flat price", () => {
    let billed = 0;
    for (let i = 0; i < 500; i++) billed += nextUsageChargeCents(billed);
    expect(PLANS.starter.monthlyCents + billed).toBe(PLANS.rescue.monthlyCents);
  });

  it("uncapped cost math is unchanged below the crossover", () => {
    expect(monthlyCostCents("starter", 10)).toBe(1900);
  });
});
