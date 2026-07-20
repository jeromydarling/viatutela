import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildBooklet, wrapText } from "../booklet";

describe("wrapText", () => {
  it("wraps at real font widths and preserves paragraphs", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText(
      "Ziggy is five months of pure applause. Everything is the best thing that has ever happened.\n\nA second paragraph follows.",
      font,
      11,
      200,
    );
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(200 + 60); // single long words may overflow, sentences must not
    }
    expect(lines.at(-1)).toContain("second paragraph");
  });

  it("never drops words", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const text = "one two three four five six seven eight nine ten";
    const lines = wrapText(text, font, 12, 80);
    expect(lines.join(" ")).toBe(text);
  });
});

describe("buildBooklet", () => {
  it("produces a 4-page half-letter PDF without photos", async () => {
    const pdf = await buildBooklet({
      animal: {
        name: "Testcase", species: "dog", breed: "beagle", sex: "female", dob: "2020-01-01",
        description: "A very good dog with a long and heartwarming story that wraps across lines.",
        bonded: true, microchip: "981-TEST", intake_date: "2026-01-01",
      },
      org: { name: "Test Rescue", email: "hi@test.org", phone: "555-0100", address: "1 Main St", website: null },
      medical: [{ date: "2026-02-01", type: "vaccine", description: "DHPP" }],
      photoJpegs: [],
      pageUrl: "https://viatutela.pet/adopt/test/an_1",
    });
    expect(pdf.byteLength).toBeGreaterThan(2000);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(4);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(396);
    expect(Math.round(height)).toBe(612);
    expect(doc.getTitle()).toBe("Testcase — Test Rescue");
  });
});
