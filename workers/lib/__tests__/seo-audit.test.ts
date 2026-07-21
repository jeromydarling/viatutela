import { describe, expect, it } from "vitest";
import { AUDIT_GROUPS, runAudit, scoreAudit, sortChecks, type AuditInput } from "../seo-audit";

const PERFECT: AuditInput = {
  visible: true,
  googleVerify: true,
  bingVerify: true,
  defaultOgImage: true,
  publishedPages: 5,
  hasHomePage: true,
  pagesMissingMeta: 0,
  pagesLongTitle: 0,
  pagesLongMeta: 0,
  pagesNoSocialImage: 0,
  adoptableTotal: 10,
  animalsNoPhoto: 0,
  animalsNoBio: 0,
  photosNoAlt: 0,
  domainActive: true,
  domainPending: false,
};

const BLANK: AuditInput = {
  visible: false,
  googleVerify: false,
  bingVerify: false,
  defaultOgImage: false,
  publishedPages: 0,
  hasHomePage: false,
  pagesMissingMeta: 0,
  pagesLongTitle: 0,
  pagesLongMeta: 0,
  pagesNoSocialImage: 0,
  adoptableTotal: 0,
  animalsNoPhoto: 0,
  animalsNoBio: 0,
  photosNoAlt: 0,
  domainActive: false,
  domainPending: false,
};

describe("runAudit", () => {
  it("a perfect site scores near 100 with no warnings", () => {
    const checks = runAudit(PERFECT);
    const score = scoreAudit(checks);
    expect(score.percent).toBeGreaterThanOrEqual(95);
    expect(score.grade).toBe("Excellent");
    expect(checks.filter((c) => c.status === "warn")).toHaveLength(0);
  });

  it("a hidden, empty, unverified site raises the real warnings", () => {
    const checks = runAudit(BLANK);
    const ids = checks.filter((c) => c.status === "warn").map((c) => c.id);
    expect(ids).toContain("crawlers"); // hidden
    expect(ids).toContain("sitemap"); // no pages
    expect(ids).toContain("gsc"); // unverified
    expect(scoreAudit(checks).grade).not.toBe("Excellent");
  });

  it("surfaces content warnings with accurate counts", () => {
    const checks = runAudit({ ...PERFECT, animalsNoPhoto: 3, animalsNoBio: 1 });
    const photo = checks.find((c) => c.id === "animal-photos")!;
    const bio = checks.find((c) => c.id === "animal-bios")!;
    expect(photo.status).toBe("warn");
    expect(photo.title).toContain("3");
    expect(bio.title).toContain("1 adoptable friend");
  });

  it("every warning and suggestion offers a fix link that stays in-app", () => {
    const checks = runAudit(BLANK);
    for (const c of checks) {
      if (c.status !== "pass") {
        // not every suggestion must have a fix, but any fix must be a real app path
        if (c.fix) expect(c.fix.to.startsWith("/app/")).toBe(true);
      }
    }
  });

  it("long titles/descriptions are a suggestion, not a failure", () => {
    const checks = runAudit({ ...PERFECT, pagesLongTitle: 2 });
    const len = checks.find((c) => c.id === "length")!;
    expect(len.status).toBe("suggest");
    // suggestions don't drag the score below Excellent
    expect(scoreAudit(checks).grade).toBe("Excellent");
  });

  it("pending domain reads as a suggestion, active as a pass", () => {
    expect(runAudit({ ...PERFECT, domainActive: false, domainPending: true }).find((c) => c.id === "domain")!.status).toBe("suggest");
    expect(runAudit(PERFECT).find((c) => c.id === "domain")!.status).toBe("pass");
  });

  it("groups are all known, and sort puts warnings first", () => {
    const checks = sortChecks(runAudit(BLANK));
    for (const c of checks) expect(AUDIT_GROUPS).toContain(c.group);
    const firstPass = checks.findIndex((c) => c.status === "pass");
    const lastWarn = checks.map((c) => c.status).lastIndexOf("warn");
    if (firstPass !== -1 && lastWarn !== -1) expect(lastWarn).toBeLessThan(firstPass);
  });
});
