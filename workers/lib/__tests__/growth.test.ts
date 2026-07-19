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
