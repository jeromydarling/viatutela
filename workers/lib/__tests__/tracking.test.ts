import { describe, expect, it } from "vitest";
import { EMPTY_TRACKING, TRACKER_FIELDS, hasTracking, validateTracking } from "../tracking";

describe("validateTracking", () => {
  it("accepts well-formed IDs and normalizes case", () => {
    const { tracking, errors } = validateTracking({
      ga4: "  g-abc123xyz9 ",
      gtm: "gtm-w4bc9d",
      meta_pixel: " 123456789012345 ",
      plausible: " SunnyMeadow.org ",
    });
    expect(errors).toEqual([]);
    expect(tracking).toEqual({
      ga4: "G-ABC123XYZ9",
      gtm: "GTM-W4BC9D",
      meta_pixel: "123456789012345",
      plausible: "sunnymeadow.org",
    });
  });

  it("treats empty and missing values as off, without errors", () => {
    const { tracking, errors } = validateTracking({ ga4: "", plausible: "   " });
    expect(errors).toEqual([]);
    expect(tracking).toEqual(EMPTY_TRACKING);
    expect(hasTracking(tracking)).toBe(false);
  });

  it("rejects script injection attempts in every field", () => {
    const evil = [
      `<script>alert(1)</script>`,
      `G-ABC"onload="x`,
      `G-ABC'};alert(1);//`,
      `javascript:alert(1)`,
      `G-ABC</script><script>`,
    ];
    for (const value of evil) {
      const { tracking, errors } = validateTracking({
        ga4: value,
        gtm: value,
        meta_pixel: value,
        plausible: value,
      });
      expect(tracking).toEqual(EMPTY_TRACKING);
      expect(errors.length).toBe(4);
    }
  });

  it("rejects near-miss formats", () => {
    const { tracking, errors } = validateTracking({
      ga4: "UA-1234567-1", // old Universal Analytics, not GA4
      gtm: "GTM_ABC123", // underscore
      meta_pixel: "1234567", // too short
      plausible: "notadomain", // no dot
    });
    expect(tracking).toEqual(EMPTY_TRACKING);
    expect(errors.length).toBe(4);
  });

  it("drops non-string values silently", () => {
    const { tracking, errors } = validateTracking({
      ga4: 123,
      gtm: { a: 1 },
      meta_pixel: ["1234567890"],
      plausible: null,
    });
    expect(tracking).toEqual(EMPTY_TRACKING);
    expect(errors).toEqual([]);
  });

  it("keeps valid fields when another field is invalid", () => {
    const { tracking, errors } = validateTracking({
      ga4: "G-VALID123",
      gtm: "<script>",
    });
    expect(tracking.ga4).toBe("G-VALID123");
    expect(tracking.gtm).toBe("");
    expect(errors.length).toBe(1);
  });

  it("every pattern refuses characters that could break out of an attribute or string", () => {
    for (const field of TRACKER_FIELDS) {
      for (const ch of [`"`, `'`, `<`, `>`, `&`, `\``, ` `, `\\`, `/`]) {
        expect(field.pattern.test(`G-ABC${ch}DEF`)).toBe(false);
      }
    }
  });
});
