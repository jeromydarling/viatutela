/**
 * The friend booklet — a warm, print-ready PDF keepsake for one animal:
 * cover with their photo, their story, a facts & care page, and a back
 * cover with a QR code to their page and the shelter's contact info.
 *
 * Phase 1 of the print story: shelters email it to adopters or print at
 * home. Phase 2 sends the same PDF to Lulu's print-on-demand API for a
 * real bound booklet (gated on Lulu credentials).
 *
 * Half-letter pages (5.5" × 8.5") — prints two-up on letter paper and
 * matches Lulu's digest trim size.
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const PAGE_W = 396; // 5.5in * 72
const PAGE_H = 612; // 8.5in * 72
const MARGIN = 42;

const CREAM = rgb(0.984, 0.953, 0.894);
const CHARCOAL = rgb(0.2, 0.19, 0.17);
const SOFT = rgb(0.42, 0.39, 0.35);
const MEADOW = rgb(0.24, 0.55, 0.38);

export interface BookletAnimal {
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  dob: string | null;
  description: string | null;
  bonded: boolean;
  microchip: string | null;
  intake_date: string | null;
}

export interface BookletMedical {
  date: string | null;
  type: string | null;
  description: string | null;
}

export interface BookletOrg {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
}

/** Greedy word wrap using real font metrics. Exported for tests. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; font: PDFFont; size: number; maxWidth: number; lineHeight?: number; color?: ReturnType<typeof rgb>; maxLines?: number },
): number {
  const lines = wrapText(text, opts.font, opts.size, opts.maxWidth);
  const lh = opts.lineHeight ?? opts.size * 1.45;
  let y = opts.y;
  let drawn = 0;
  for (const line of lines) {
    if (opts.maxLines && drawn >= opts.maxLines) break;
    page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color ?? CHARCOAL });
    y -= lh;
    drawn++;
  }
  return y;
}

/** Draw a QR code as vector squares — no raster, crisp at any print size. */
function drawQr(page: PDFPage, text: string, x: number, y: number, size: number): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const cell = size / count;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.modules.get(row, col)) {
        page.drawRectangle({
          x: x + col * cell,
          y: y + size - (row + 1) * cell,
          width: cell + 0.15, // slight overlap avoids hairline print gaps
          height: cell + 0.15,
          color: CHARCOAL,
        });
      }
    }
  }
}

function ageLine(dob: string | null): string | null {
  if (!dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!isFinite(years) || years < 0) return null;
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months young`;
  return `about ${Math.floor(years)} year${years >= 2 ? "s" : ""} of stories`;
}

export async function buildBooklet(args: {
  animal: BookletAnimal;
  org: BookletOrg;
  medical: BookletMedical[];
  photoJpegs: Uint8Array[]; // pre-converted to JPEG (IMAGES binding handles webp → jpeg)
  pageUrl: string;
}): Promise<Uint8Array> {
  const { animal, org, medical, photoJpegs, pageUrl } = args;
  const doc = await PDFDocument.create();
  doc.setTitle(`${animal.name} — ${org.name}`);
  doc.setAuthor(org.name);

  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bodyBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const images = [];
  for (const bytes of photoJpegs.slice(0, 3)) {
    try {
      images.push(await doc.embedJpg(bytes));
    } catch {
      // a photo that won't embed never sinks the booklet
    }
  }

  // ---------- cover ----------
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  cover.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
  cover.drawText(org.name, { x: MARGIN, y: PAGE_H - MARGIN - 10, size: 11, font: bodyBold, color: SOFT });
  cover.drawText(animal.name, {
    x: MARGIN,
    y: PAGE_H - MARGIN - 52,
    size: Math.min(44, (PAGE_W - MARGIN * 2) / (animal.name.length * 0.52)),
    font: serif,
    color: CHARCOAL,
  });
  const subtitle = [animal.breed ?? animal.species, animal.sex, ageLine(animal.dob)].filter(Boolean).join(" · ");
  if (subtitle) {
    cover.drawText(subtitle, { x: MARGIN, y: PAGE_H - MARGIN - 76, size: 11, font: body, color: SOFT });
  }
  if (images[0]) {
    const frame = { w: PAGE_W - MARGIN * 2, h: 330 };
    const scale = Math.min(frame.w / images[0].width, frame.h / images[0].height);
    const w = images[0].width * scale;
    const h = images[0].height * scale;
    cover.drawImage(images[0], { x: (PAGE_W - w) / 2, y: 150, width: w, height: h });
  }
  cover.drawText("a friend's story", { x: MARGIN, y: 96, size: 12, font: body, color: SOFT });
  if (animal.bonded) {
    cover.drawText("part of a bonded pair — hearts that go home together", {
      x: MARGIN, y: 76, size: 10, font: bodyBold, color: MEADOW,
    });
  }

  // ---------- story ----------
  const story = doc.addPage([PAGE_W, PAGE_H]);
  story.drawText(`About ${animal.name}`, { x: MARGIN, y: PAGE_H - MARGIN - 14, size: 20, font: serif, color: CHARCOAL });
  let y = PAGE_H - MARGIN - 46;
  const storyText =
    animal.description?.trim() ||
    `${animal.name} is still writing their story — and the best chapters start the day they come home.`;
  y = drawWrapped(story, storyText, {
    x: MARGIN, y, font: body, size: 11, maxWidth: PAGE_W - MARGIN * 2, maxLines: 26,
  });
  if (images[1]) {
    const frame = { w: PAGE_W - MARGIN * 2, h: Math.max(120, y - 90) };
    const scale = Math.min(frame.w / images[1].width, frame.h / images[1].height);
    const w = images[1].width * scale;
    const h = images[1].height * scale;
    if (h > 60) story.drawImage(images[1], { x: (PAGE_W - w) / 2, y: 64, width: w, height: h });
  }

  // ---------- facts & care ----------
  const facts = doc.addPage([PAGE_W, PAGE_H]);
  facts.drawText("The particulars", { x: MARGIN, y: PAGE_H - MARGIN - 14, size: 20, font: serif, color: CHARCOAL });
  let fy = PAGE_H - MARGIN - 50;
  const rows: [string, string][] = [];
  if (animal.species) rows.push(["Species", animal.species]);
  if (animal.breed) rows.push(["Breed", animal.breed]);
  if (animal.sex) rows.push(["Sex", animal.sex]);
  if (animal.dob) rows.push(["Born", animal.dob]);
  if (animal.intake_date) rows.push(["In our care since", animal.intake_date]);
  if (animal.microchip) rows.push(["Microchip", animal.microchip]);
  for (const [k, v] of rows) {
    facts.drawText(k, { x: MARGIN, y: fy, size: 10, font: bodyBold, color: SOFT });
    facts.drawText(v.slice(0, 60), { x: MARGIN + 120, y: fy, size: 10, font: body, color: CHARCOAL });
    fy -= 18;
  }
  if (medical.length) {
    fy -= 14;
    facts.drawText("Medical highlights", { x: MARGIN, y: fy, size: 13, font: serif, color: CHARCOAL });
    fy -= 22;
    for (const m of medical.slice(0, 10)) {
      const line = [m.date, m.type, m.description].filter(Boolean).join(" — ").slice(0, 90);
      facts.drawText(line, { x: MARGIN, y: fy, size: 9, font: body, color: CHARCOAL });
      fy -= 14;
      if (fy < 120) break;
    }
    facts.drawText("Full records travel with the adoption paperwork.", { x: MARGIN, y: fy - 6, size: 8.5, font: body, color: SOFT });
  }

  // ---------- back cover ----------
  const back = doc.addPage([PAGE_W, PAGE_H]);
  back.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
  back.drawText(`Come meet ${animal.name}`, { x: MARGIN, y: PAGE_H - MARGIN - 20, size: 18, font: serif, color: CHARCOAL });
  drawQr(back, pageUrl, (PAGE_W - 150) / 2, PAGE_H - 320, 150);
  back.drawText("scan for photos, videos, and the application", {
    x: MARGIN, y: PAGE_H - 348, size: 9.5, font: body, color: SOFT,
  });
  let by = 170;
  by = drawWrapped(back, org.name, { x: MARGIN, y: by, font: bodyBold, size: 12, maxWidth: PAGE_W - MARGIN * 2 });
  for (const line of [org.address, org.phone, org.email, org.website].filter(Boolean) as string[]) {
    by = drawWrapped(back, line, { x: MARGIN, y: by, font: body, size: 10, maxWidth: PAGE_W - MARGIN * 2 });
  }
  back.drawText("Every adoption opens a kennel for the next friend in need.", {
    x: MARGIN, y: 64, size: 9.5, font: body, color: MEADOW,
  });

  return doc.save();
}
