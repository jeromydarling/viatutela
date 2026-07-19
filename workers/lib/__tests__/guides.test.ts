import { describe, expect, it } from "vitest";
import { GUIDES, getGuide, relatedGuides } from "../../../app/lib/guides";

const KNOWN_ROUTES = ["/", "/import", "/signup", "/demo", "/login", "/guides", "/privacy", "/terms"];

function isValidInternalLink(to: string): boolean {
  if (to.startsWith("/#")) return true;
  if (to.startsWith("/guides/")) return GUIDES.some((g) => `/guides/${g.slug}` === to);
  return KNOWN_ROUTES.includes(to);
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

  it("comparison pages stay consistent with the home-page chart claims", () => {
    const shelterluv = getGuide("shelterluv-alternative");
    expect(JSON.stringify(shelterluv)).toContain("$2 per adoption");
    const rg = getGuide("rescuegroups-alternative");
    expect(JSON.stringify(rg)).toContain("$75");
  });
});
