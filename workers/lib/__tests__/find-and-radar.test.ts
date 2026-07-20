import { describe, expect, it } from "vitest";
import { FIND_LAUNCH_STATES, US_STATES, isUsState, matchesAlert } from "../adopt-alerts";
import { isAdoptionIntent } from "../radar";

describe("matchesAlert", () => {
  const biscuit = {
    name: "Biscuit",
    species: "dog",
    breed: "beagle mix",
    description: "A gentle senior fellow who loves naps.",
    orgState: "CO",
  };

  it("matches on state + species + keyword", () => {
    expect(matchesAlert({ state: "CO", species: "dog", keywords: "senior" }, biscuit)).toBe(true);
    expect(matchesAlert({ state: null, species: null, keywords: null }, biscuit)).toBe(true);
    expect(matchesAlert({ state: "CO", species: "any", keywords: "" }, biscuit)).toBe(true);
    expect(matchesAlert({ state: null, species: "dog", keywords: "beagle, husky" }, biscuit)).toBe(true);
  });

  it("gates out mismatches", () => {
    expect(matchesAlert({ state: "TX", species: "dog", keywords: null }, biscuit)).toBe(false);
    expect(matchesAlert({ state: "CO", species: "cat", keywords: null }, biscuit)).toBe(false);
    expect(matchesAlert({ state: "CO", species: "dog", keywords: "kitten" }, biscuit)).toBe(false);
    expect(matchesAlert({ state: "CO", species: "dog", keywords: null }, { ...biscuit, orgState: null })).toBe(false);
  });

  it("short keyword tokens are ignored, longer ones match anywhere in the haystack", () => {
    expect(matchesAlert({ state: null, species: null, keywords: "a an of" }, biscuit)).toBe(false);
    expect(matchesAlert({ state: null, species: null, keywords: "naps" }, biscuit)).toBe(true);
  });

  it("state helpers", () => {
    expect(US_STATES.length).toBe(51); // 50 + DC
    expect(isUsState("CO")).toBe(true);
    expect(isUsState("XX")).toBe(false);
  });

  it("the /find launch gate requires a third of the country", () => {
    expect(FIND_LAUNCH_STATES).toBe(17); // ceil(50 / 3)
  });
});

describe("isAdoptionIntent", () => {
  it("accepts real adoption-intent posts", () => {
    for (const text of [
      "We're finally looking to adopt a dog! Any shelter recommendations in Denver?",
      "thinking about adopting a kitten, first time cat owner, tips?",
      "Where should I adopt a rabbit near Austin?",
      "Ready to adopt — want an older cat who just chills",
    ]) {
      expect(isAdoptionIntent(text), text).toBe(true);
    }
  });

  it("rejects the classic false positives", () => {
    for (const text of [
      "We're looking to adopt a child and start our family",       // not a pet
      "Our company adopted a highway cleanup program",              // adopt-a-highway
      "We adopted our dog last year, best decision ever",           // past tense, done
      "New puppy pics!",                                            // no intent phrase
      "The senate wants to adopt a new resolution on pets",         // intent phrase absent
    ]) {
      expect(isAdoptionIntent(text), text).toBe(false);
    }
  });
});
