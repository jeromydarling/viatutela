import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, scrapeHomepage, validateBrand } from "../brand";

describe("validateBrand", () => {
  it("rejects bad hex, unknown font keys, and out-of-range numbers with fallbacks", () => {
    const b = validateBrand({
      palette: { primary: "red", accent: "#ZZZZZZ", ink: "#101010", bg: "#fffdf7" },
      typography: "comic-sans-deluxe", // model-invented
      wordmark: { font: "papyrus", case: "sideways", tracking: 9999, weight: 12 },
      tagline: "x".repeat(500),
      voice: "",
    });
    expect(b.palette.primary).toBe(DEFAULT_BRAND.palette.primary);
    expect(b.palette.accent).toBe(DEFAULT_BRAND.palette.accent);
    expect(b.palette.ink).toBe("#101010");
    expect(b.typography).toBe("friendly");
    expect(b.wordmark.font).toBe("fredoka");
    expect(b.wordmark.case).toBe("title");
    expect(b.wordmark.tracking).toBe(300); // clamped
    expect(b.wordmark.weight).toBe(400); // clamped
    expect(b.tagline.length).toBe(200);
    expect(b.voice).toBe(DEFAULT_BRAND.voice);
  });

  it("keeps the legacy single accent in sync and honors legacy brand_json", () => {
    const b = validateBrand({ accent: "#AB34CD", tagline: "hi" });
    expect(b.palette.accent).toBe("#ab34cd");
    expect(b.accent).toBe("#ab34cd");
    expect(b.tagline).toBe("hi");
  });

  it("only accepts media-library logo urls", () => {
    expect(validateBrand({ logo: { kind: "image", imageUrl: "https://evil.example/x.png" } }).logo.imageUrl).toBeNull();
    const ok = validateBrand({ logo: { kind: "image", imageUrl: "/api/media/orgs/o1/site/logo.png" } });
    expect(ok.logo.kind).toBe("image");
    expect(ok.logo.imageUrl).toBe("/api/media/orgs/o1/site/logo.png");
  });
});

describe("scrapeHomepage", () => {
  it("pulls name, logo, and mid-tone colors; decodes entities; absolutizes urls", () => {
    const html = `<html><head>
      <title>Happy Paws Rescue &amp; Sanctuary | Home</title>
      <meta property="og:site_name" content="Happy Paws Rescue &amp; Sanctuary">
      <link rel="icon" href="/favicon.png">
      <style>.btn{background:#e07a5f}.hdr{color:#2f7fb0}.x{color:#fefefe}</style>
      </head><body><div style="background:#e07a5f">…</div></body></html>`;
    const s = scrapeHomepage(html, "https://happypaws.example/");
    expect(s.name).toBe("Happy Paws Rescue & Sanctuary");
    expect(s.logoUrl).toBe("https://happypaws.example/favicon.png");
    expect(s.colors).toContain("#e07a5f");
    expect(s.colors).not.toContain("#fefefe"); // near-white filtered
  });
});
