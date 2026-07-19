import { describe, expect, it } from "vitest";
import { MAX_SECTIONS, validateSections } from "../site-sections";

describe("validateSections — loose blocks, hard shell", () => {
  it("accepts known types with arbitrary per-type fields (passthrough)", () => {
    const v = validateSections([
      { type: "prose", md: "hello", some_future_field: 42 },
      { type: "faq", heading: "Q&A", items: [{ q: "a?", a: "b" }] },
    ]);
    expect(v.ok).toBe(true);
    expect(v.sections[0].some_future_field).toBe(42);
  });

  it("rejects unknown section types", () => {
    const v = validateSections([{ type: "sql_injection_widget", x: 1 }]);
    expect(v.ok).toBe(false);
    expect(v.error).toContain("unknown type");
  });

  it("rejects non-objects and missing type", () => {
    expect(validateSections([null]).ok).toBe(false);
    expect(validateSections(["prose"]).ok).toBe(false);
    expect(validateSections([{ md: "no type" }]).ok).toBe(false);
    expect(validateSections("not an array").ok).toBe(false);
  });

  it("caps the section count", () => {
    const many = Array.from({ length: MAX_SECTIONS + 1 }, () => ({ type: "prose" as const, md: "x" }));
    expect(validateSections(many).ok).toBe(false);
  });

  it("caps serialized size at 120KB", () => {
    const big = [{ type: "prose" as const, md: "x".repeat(130 * 1024) }];
    const v = validateSections(big);
    expect(v.ok).toBe(false);
    expect(v.error).toContain("120KB");
  });
});
