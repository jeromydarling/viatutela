import { describe, expect, it } from "vitest";
import { bareHost, normalizeDomain } from "../domains";

describe("normalizeDomain", () => {
  it("normalizes hard before validating", () => {
    expect(normalizeDomain("HappyPawsRescue.org")).toBe("happypawsrescue.org");
    expect(normalizeDomain("https://happypawsrescue.org/adopt?x=1#top")).toBe("happypawsrescue.org");
    expect(normalizeDomain("http://www.happypawsrescue.org")).toBe("happypawsrescue.org");
    expect(normalizeDomain("  www.happy-paws.org.  ")).toBe("happy-paws.org");
    expect(normalizeDomain("shelter.co.uk:8080")).toBe("shelter.co.uk");
  });

  it("rejects garbage", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("no_underscores.com")).toBeNull();
    expect(normalizeDomain("http://")).toBeNull();
    expect(normalizeDomain("just-a-tld")).toBeNull();
    expect(normalizeDomain("trailing-.com")).toBe("trailing-.com"); // hyphen edge is allowed by the spec regex
  });
});

describe("bareHost", () => {
  it("strips www for tenant matching", () => {
    expect(bareHost("www.happypawsrescue.org")).toBe("happypawsrescue.org");
    expect(bareHost("HAPPYPAWSRESCUE.ORG.")).toBe("happypawsrescue.org");
    expect(bareHost("shelter.org")).toBe("shelter.org");
  });
});
