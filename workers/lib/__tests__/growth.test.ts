import { describe, expect, it } from "vitest";
import { matchesSubscription } from "../waitlist";
import { followupPlan } from "../lifecycle";

const animal = {
  name: "Pearl",
  species: "cat",
  breed: "domestic longhair",
  description: "Pearl is eleven, silk-soft, and completely over drama.",
  bonded: false,
  senior: true,
};

describe("matchesSubscription", () => {
  it("gates on species and matches any keyword token", () => {
    expect(matchesSubscription({ id: "1", email: "a@b.co", name: null, species: "cat", keywords: "senior" }, animal)).toBe(true);
    expect(matchesSubscription({ id: "2", email: "a@b.co", name: null, species: "dog", keywords: "senior" }, animal)).toBe(false);
    expect(matchesSubscription({ id: "3", email: "a@b.co", name: null, species: "any", keywords: null }, animal)).toBe(true);
    expect(matchesSubscription({ id: "4", email: "a@b.co", name: null, species: "cat", keywords: "longhair, playful" }, animal)).toBe(true);
    expect(matchesSubscription({ id: "5", email: "a@b.co", name: null, species: "cat", keywords: "puppy husky" }, animal)).toBe(false);
  });
  it("understands bonded-pair and senior shorthand", () => {
    const bonded = { ...animal, senior: false, bonded: true, description: "" };
    expect(matchesSubscription({ id: "6", email: "a@b.co", name: null, species: "any", keywords: "bonded" }, bonded)).toBe(true);
    expect(matchesSubscription({ id: "7", email: "a@b.co", name: null, species: "any", keywords: "older" }, animal)).toBe(true);
  });
  it("ignores tiny noise tokens", () => {
    expect(matchesSubscription({ id: "8", email: "a@b.co", name: null, species: "any", keywords: "a an is" }, animal)).toBe(false);
  });
});

describe("followupPlan", () => {
  it("covers the retention arc: settle-in, honeymoon, donor moment, anniversary", () => {
    const plan = followupPlan();
    expect(plan.map((p) => p.kind)).toEqual(["day3", "week2", "month6", "gotcha_day"]);
    expect(plan.every((p, i) => i === 0 || p.days > plan[i - 1].days)).toBe(true);
  });
});

describe("public animal filters", () => {
  it("filters by species, age group, sex, bonded, and text — and hides below the threshold", async () => {
    const { filterAnimals, ageGroup, speciesPresent, FILTERS_APPEAR_AT, EMPTY_FILTER } = await import("../animal-filter");
    const now = Date.parse("2026-07-19");
    const zoo = [
      { id: "1", name: "Pearl", species: "cat", breed: "longhair", sex: "female", dob: "2015-01-01", description: "senior sweetheart", bonded_group_id: null },
      { id: "2", name: "Ziggy", species: "dog", breed: "lab mix", sex: "male", dob: "2026-02-01", description: "puppy applause", bonded_group_id: null },
      { id: "3", name: "Biscuit", species: "dog", breed: "terrier", sex: "male", dob: "2022-01-01", description: "squeaky toys", bonded_group_id: "bg1" },
    ];
    expect(ageGroup("2015-01-01", now)).toBe("senior");
    expect(ageGroup("2026-02-01", now)).toBe("young");
    expect(filterAnimals(zoo, { ...EMPTY_FILTER, species: "dog" }, now).map((a) => a.id)).toEqual(["2", "3"]);
    expect(filterAnimals(zoo, { ...EMPTY_FILTER, age: "senior" }, now).map((a) => a.id)).toEqual(["1"]);
    expect(filterAnimals(zoo, { ...EMPTY_FILTER, sex: "male", bonded: true }, now).map((a) => a.id)).toEqual(["3"]);
    expect(filterAnimals(zoo, { ...EMPTY_FILTER, q: "squeaky" }, now).map((a) => a.id)).toEqual(["3"]);
    expect(speciesPresent(zoo)).toEqual(["dog", "cat"]);
    expect(FILTERS_APPEAR_AT).toBeGreaterThan(3); // a handful of animals stays a simple list
  });
});

describe("pricing crossover", () => {
  it("Starter beats the flat tier until ~30 adoptions/month", async () => {
    const { monthlyCostCents, recommendPlan, PLANS } = await import("../pricing");
    expect(PLANS.starter.monthlyCents).toBe(900);
    expect(PLANS.starter.perAdoptionCents).toBe(100);
    expect(monthlyCostCents("starter", 0)).toBe(900);
    expect(monthlyCostCents("starter", 10)).toBe(1900);
    expect(monthlyCostCents("starter", 30)).toBe(3900); // = Rescue flat
    expect(recommendPlan(5).key).toBe("starter");
    expect(recommendPlan(29).key).toBe("starter");
    expect(recommendPlan(30).key).toBe("rescue"); // crossover: 9 + 30 = 39
    expect(recommendPlan(100).key).toBe("rescue");
    expect(monthlyCostCents("rescue", 500)).toBe(3900); // flat tiers never meter
  });
});

describe("onboarding drip", () => {
  it("schedules day 1, 3, 7", async () => {
    const { onboardingPlan } = await import("../onboarding");
    expect(onboardingPlan().map((p) => [p.kind, p.days])).toEqual([["day1", 1], ["day3", 3], ["day7", 7]]);
  });
});
