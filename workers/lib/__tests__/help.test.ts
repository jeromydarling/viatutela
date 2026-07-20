import { describe, expect, it } from "vitest";
import { HELP, HELP_CATEGORIES, getHelpArticle, helpByCategory } from "../../../app/lib/help";

// every internal link a help article may use must resolve to a real route
const KNOWN_PREFIXES = [
  "/app/animals", "/app/people", "/app/applications", "/app/fosters", "/app/volunteers",
  "/app/donations", "/app/grants", "/app/network", "/app/website", "/app/brand",
  "/app/marketing", "/app/radar", "/app/reports", "/app/settings", "/app/help",
];
const KNOWN_EXACT = ["/import", "/demo", "/contact", "/privacy", "/terms", "/#pricing", "/find"];

function linkOk(to: string): boolean {
  if (KNOWN_EXACT.includes(to)) return true;
  if (to.startsWith("/guides/")) return true; // validated by the guides suite
  return KNOWN_PREFIXES.some((p) => to === p || to.startsWith(`${p}/`));
}

describe("the Field Guide", () => {
  it("has unique slugs, valid categories, real content", () => {
    const slugs = HELP.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(HELP.length).toBeGreaterThanOrEqual(20);
    for (const a of HELP) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(HELP_CATEGORIES).toContain(a.category);
      expect(a.summary.length).toBeGreaterThan(20);
      expect(a.blocks.length).toBeGreaterThanOrEqual(1);
      const words = a.blocks
        .flatMap((b) => [b.p ?? "", b.tip ?? "", ...(b.list ?? []), ...(b.steps ?? [])])
        .join(" ")
        .split(/\s+/).length;
      expect(words, `${a.slug} is too thin`).toBeGreaterThan(60);
    }
  });

  it("every category has at least one article, every app area is covered", () => {
    for (const g of helpByCategory()) expect(g.articles.length).toBeGreaterThan(0);
    // one article per nav destination, minimum
    for (const key of [
      "importing", "animal-profiles", "photo-studio", "medical-records", "people-crm",
      "applications", "fosters", "volunteers-shifts", "donations", "online-giving", "grants",
      "website-builder", "custom-domain", "seo-and-analytics", "brand-studio", "marketing-studio",
      "adopter-radar", "first-zap", "api-keys-webhooks", "your-data", "pricing-billing",
    ]) {
      expect(getHelpArticle(key), `missing article: ${key}`).toBeDefined();
    }
  });

  it("internal links all point at real routes", () => {
    const inline = /\[[^\]]+\]\(([^)]+)\)/g;
    for (const a of HELP) {
      const texts = a.blocks.flatMap((b) => [b.p ?? "", b.tip ?? "", ...(b.list ?? []), ...(b.steps ?? [])]);
      for (const t of texts) {
        for (const m of t.matchAll(inline)) {
          expect(linkOk(m[1]), `${a.slug} links to ${m[1]}`).toBe(true);
        }
      }
    }
  });

  it("the Zapier walkthrough earns its flagship billing", () => {
    const zap = getHelpArticle("first-zap");
    const text = JSON.stringify(zap);
    for (const marker of ["Catch Hook", "Send test ping", "elivery log", "recipe library", "no code"]) {
      expect(text).toContain(marker);
    }
  });
});
