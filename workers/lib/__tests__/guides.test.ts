import { describe, expect, it } from "vitest";
import { GUIDES, getGuide, relatedGuides } from "../../../app/lib/guides";
import { STATES, getState, nearbyStates, REGION_NOTES } from "../../../app/lib/guide-states";

const KNOWN_ROUTES = ["/", "/import", "/signup", "/demo", "/login", "/guides", "/privacy", "/terms", "/guides/start-a-rescue"];

function isValidInternalLink(to: string): boolean {
  if (to.startsWith("/#")) return true;
  if (KNOWN_ROUTES.includes(to)) return true;
  if (to.startsWith("/guides/start-a-rescue/")) {
    return STATES.some((s) => `/guides/start-a-rescue/${s.slug}` === to);
  }
  if (to.startsWith("/guides/")) return GUIDES.some((g) => `/guides/${g.slug}` === to);
  return false;
}

describe("guides registry", () => {
  it("has unique slugs and required fields", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES) {
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
      expect(g.title.length).toBeGreaterThan(10);
      expect(g.description.length).toBeGreaterThan(50);
      expect(g.description.length).toBeLessThanOrEqual(170);
      expect(g.blocks.length).toBeGreaterThan(4);
      expect(g.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every CTA and inline link points at a real route", () => {
    const inlineLink = /\[[^\]]+\]\(([^)]+)\)/g;
    for (const g of GUIDES) {
      expect(isValidInternalLink(g.cta.to), `${g.slug} cta ${g.cta.to}`).toBe(true);
      const texts = g.blocks.flatMap((b) => [b.p ?? "", b.tip ?? "", ...(b.list ?? [])]);
      for (const t of texts) {
        for (const m of t.matchAll(inlineLink)) {
          expect(isValidInternalLink(m[1]), `${g.slug} links to ${m[1]}`).toBe(true);
        }
      }
    }
  });

  it("getGuide and relatedGuides behave", () => {
    expect(getGuide("switch-shelter-software")?.category).toBe("Switching");
    expect(getGuide("nope")).toBeUndefined();
    const rel = relatedGuides(GUIDES[0]);
    expect(rel.length).toBe(3);
    expect(rel.map((g) => g.slug)).not.toContain(GUIDES[0].slug);
  });

  it("covers all 50 states with unique slugs and a region note each", () => {
    expect(STATES.length).toBe(50);
    expect(new Set(STATES.map((s) => s.slug)).size).toBe(50);
    for (const s of STATES) {
      expect(s.slug).toMatch(/^[a-z-]+$/);
      expect(REGION_NOTES[s.region]).toBeDefined();
      expect(s.corp.length).toBeGreaterThan(5);
    }
    expect(getState("texas")?.abbr).toBe("TX");
    expect(getState("narnia")).toBeUndefined();
    const near = nearbyStates(getState("colorado")!);
    expect(near.length).toBeGreaterThan(0);
    expect(near.map((s) => s.slug)).not.toContain("colorado");
  });

  it("comparison pages stay consistent with the home-page chart claims", () => {
    const shelterluv = getGuide("shelterluv-alternative");
    expect(JSON.stringify(shelterluv)).toContain("$2 per adoption");
    const rg = getGuide("rescuegroups-alternative");
    expect(JSON.stringify(rg)).toContain("$75");
  });
});
