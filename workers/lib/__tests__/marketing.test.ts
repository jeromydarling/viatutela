import { describe, expect, it } from "vitest";
import { CHANNELS, channelByKey, enforceCaps } from "../marketing";

describe("channel catalog", () => {
  it("is complete data — every channel has a kind, guidance contract, and caps", () => {
    expect(CHANNELS.length).toBeGreaterThanOrEqual(10);
    for (const c of CHANNELS) {
      expect(c.channel).toMatch(/^[a-z_]+$/);
      expect(c.guidance).toContain("{");
      expect(c.caps.content).toBeGreaterThan(0);
    }
    expect(channelByKey.get("facebook")).toBeDefined();
    expect(CHANNELS[0].channel).toBe("facebook"); // facebook first — it outranks everything for shelters
  });
});

describe("enforceCaps", () => {
  it("clips drifted model output to the per-channel contract", () => {
    const x = channelByKey.get("x")!;
    const clipped = enforceCaps(x, { title: "t", content: "y".repeat(500), meta: {} });
    expect(clipped.content.length).toBe(270);
  });

  it("clips ad meta to Google's limits", () => {
    const g = channelByKey.get("google_ads")!;
    const out = enforceCaps(g, {
      title: "ads",
      content: "angle",
      meta: {
        headlines: Array.from({ length: 9 }, () => "H".repeat(60)),
        descriptions: ["d".repeat(200)],
      },
    });
    expect((out.meta.headlines as string[]).length).toBe(5);
    expect((out.meta.headlines as string[])[0].length).toBe(30);
    expect((out.meta.descriptions as string[])[0].length).toBe(90);
  });

  it("normalizes hashtags and meta-ads variants", () => {
    const ig = channelByKey.get("instagram")!;
    const out = enforceCaps(ig, { title: "t", content: "c", meta: { hashtags: ["#adoptdontshop", "seniordogs"] } });
    expect(out.meta.hashtags).toEqual(["adoptdontshop", "seniordogs"]);

    const ma = channelByKey.get("meta_ads")!;
    const v = enforceCaps(ma, {
      title: "t",
      content: "c",
      meta: { variants: [{ primaryText: "p".repeat(300), headline: "h".repeat(100), description: "d".repeat(100) }] },
    });
    const variants = v.meta.variants as { primaryText: string; headline: string; description: string }[];
    expect(variants[0].primaryText.length).toBe(125);
    expect(variants[0].headline.length).toBe(40);
    expect(variants[0].description.length).toBe(30);
  });
});
