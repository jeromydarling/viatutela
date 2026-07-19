import { describe, expect, it } from "vitest";
import {
  ADJUST_RANGES,
  clampAdjustments,
  clampFocal,
  describeAdjustments,
  isNoop,
  SOCIAL_CROPS,
} from "../photo-studio";

describe("clampAdjustments", () => {
  it("keeps sensible values and drops no-ops", () => {
    const adj = clampAdjustments({ brightness: 1.2, contrast: 1, gamma: 1.05, saturation: 1, sharpen: 0 });
    expect(adj).toEqual({ brightness: 1.2, gamma: 1.05 });
  });

  it("clamps out-of-range values into the whitelist", () => {
    const adj = clampAdjustments({ brightness: 99, saturation: -5, sharpen: 40 });
    expect(adj.brightness).toBe(ADJUST_RANGES.brightness.max);
    expect(adj.saturation).toBe(ADJUST_RANGES.saturation.min);
    expect(adj.sharpen).toBe(ADJUST_RANGES.sharpen.max);
  });

  it("ignores unknown keys, junk values, and non-objects", () => {
    expect(clampAdjustments({ blur: 50, rotate: 90, brightness: "1.3", contrast: "kitten" })).toEqual({ brightness: 1.3 });
    expect(clampAdjustments(null)).toEqual({});
    expect(clampAdjustments("brightness=2")).toEqual({});
    expect(clampAdjustments({ brightness: NaN, gamma: Infinity })).toEqual({});
  });

  it("rounds to two decimals", () => {
    expect(clampAdjustments({ brightness: 1.23456 })).toEqual({ brightness: 1.23 });
  });
});

describe("isNoop / describeAdjustments", () => {
  it("recognizes an empty adjustment set", () => {
    expect(isNoop({})).toBe(true);
    expect(isNoop({ sharpen: 3 })).toBe(false);
  });

  it("describes adjustments readably", () => {
    expect(describeAdjustments({ brightness: 1.15, sharpen: 3 })).toBe("brightness ×1.15 · sharpen 3");
    expect(describeAdjustments({})).toBe("no changes");
  });
});

describe("clampFocal", () => {
  it("clamps into the unit square", () => {
    expect(clampFocal(1.7, -0.3)).toEqual({ x: 1, y: 0 });
    expect(clampFocal(0.31, 0.62)).toEqual({ x: 0.31, y: 0.62 });
  });

  it("defaults junk to a face-ish center", () => {
    expect(clampFocal("cat", undefined)).toEqual({ x: 0.5, y: 0.4 });
  });
});

describe("SOCIAL_CROPS", () => {
  it("covers square, portrait, and wide", () => {
    expect(SOCIAL_CROPS.map((c) => c.suffix)).toEqual(["sq", "tall", "wide"]);
    for (const c of SOCIAL_CROPS) expect(c.width / c.height).toBeGreaterThan(0);
  });
});
