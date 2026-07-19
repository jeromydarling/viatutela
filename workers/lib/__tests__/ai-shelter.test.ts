import { describe, expect, it } from "vitest";
import { ageLabelFromDob, compactAnimal, daysBetween } from "../ai-shelter";

const TODAY = "2026-07-19";

describe("daysBetween", () => {
  it("counts whole days and rejects garbage", () => {
    expect(daysBetween("2026-07-01", TODAY)).toBe(18);
    expect(daysBetween(null, TODAY)).toBeNull();
    expect(daysBetween("not a date", TODAY)).toBeNull();
    expect(daysBetween("2026-08-01", TODAY)).toBeNull(); // future intake = bad data, not negative days
  });
});

describe("ageLabelFromDob", () => {
  it("speaks months for babies and years for grown-ups", () => {
    expect(ageLabelFromDob("2026-04-19", TODAY)).toBe("3 months");
    expect(ageLabelFromDob("2023-06-01", TODAY)).toBe("3 years");
    expect(ageLabelFromDob("2025-06-01", TODAY)).toBe("1 year");
    expect(ageLabelFromDob(null, TODAY)).toBeNull();
  });
});

describe("compactAnimal", () => {
  it("keeps prompts small and never leaks unexpected fields", () => {
    const c = compactAnimal(
      {
        id: "an_1",
        name: "Biscuit",
        species: "dog",
        breed: "beagle mix",
        sex: "male",
        dob: "2024-06-01",
        intake_date: "2026-05-20",
        bonded_group_id: "bg_9",
        description: "x".repeat(1000),
        microchip: "SECRET-CHIP", // must not pass through
      },
      TODAY,
    );
    expect(c).toEqual({
      id: "an_1",
      name: "Biscuit",
      species: "dog",
      breed: "beagle mix",
      sex: "male",
      age: "2 years",
      days_in_care: 60,
      bonded: true,
      description: "x".repeat(400),
    });
    expect(JSON.stringify(c)).not.toContain("SECRET-CHIP");
  });
});
