import { describe, expect, it } from "vitest";
import { RECIPES, RECIPE_CATEGORIES, TRIGGER_LABELS } from "../../../app/lib/automation-recipes";
import { WEBHOOK_EVENTS } from "../integrations";
import { getGuide } from "../../../app/lib/guides";

describe("automation recipes", () => {
  it("has unique slugs, valid categories, and real setup steps", () => {
    const slugs = RECIPES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const r of RECIPES) {
      expect(r.slug).toMatch(/^[a-z0-9-]+$/);
      expect(RECIPE_CATEGORIES).toContain(r.category);
      expect(r.apps.length).toBeGreaterThan(0);
      expect(r.what.length).toBeGreaterThan(20);
      expect(r.steps.length).toBeGreaterThanOrEqual(2);
      expect(TRIGGER_LABELS[r.trigger]).toBeTruthy();
    }
  });

  it("only references trigger sources we actually ship", () => {
    const shipped = new Set<string>([...WEBHOOK_EVENTS.map((e) => e.key), "api", "calendar"]);
    for (const r of RECIPES) {
      expect(shipped.has(r.trigger), `${r.slug} uses unshipped trigger ${r.trigger}`).toBe(true);
    }
  });

  it("every category has at least two recipes", () => {
    for (const c of RECIPE_CATEGORIES) {
      expect(RECIPES.filter((r) => r.category === c).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("the public guide's recipe count matches the library", () => {
    const guide = getGuide("shelter-automation-recipes");
    expect(guide).toBeDefined();
    expect(guide?.title).toContain(String(RECIPES.length));
    expect(guide?.h1).toContain(String(RECIPES.length));
  });
});
