/**
 * Brand Studio — a shelter's identity as data.
 *
 * Tokens live in orgs.brand_json and every surface (public site, emails,
 * social templates, guidelines page) renders from them; no surface
 * hardcodes a color. Everything the AI proposes is whitelisted here
 * before it can be saved — the model WILL invent font names and
 * out-of-range values.
 */

export interface BrandPalette {
  primary: string; // structural color
  accent: string; // CTAs / donate buttons
  ink: string; // near-black text
  bg: string; // near-white page
}

export interface Wordmark {
  font: string; // key into WORDMARK_FONTS
  case: "upper" | "title" | "lower";
  tracking: number; // em/1000, clamped
  weight: number; // 400-800, clamped
}

export interface Brand {
  palette: BrandPalette;
  logo: { kind: "image" | "wordmark"; imageUrl: string | null };
  wordmark: Wordmark;
  typography: string; // key into FONT_PAIRS
  tagline: string;
  voice: string; // 1-2 sentences; quietly powers all AI copy
  /** legacy single accent kept in sync for older readers */
  accent: string;
}

/** Curated heading/body pairs; css value + Google Fonts family list. */
export const FONT_PAIRS: Record<
  string,
  { label: string; heading: string; body: string; google: string[] }
> = {
  friendly: {
    label: "Friendly — round & warm (Fredoka + Nunito)",
    heading: `'Fredoka', 'Nunito', sans-serif`,
    body: `'Nunito', Verdana, sans-serif`,
    google: ["Fredoka:wght@400;500;600;700", "Nunito:wght@400;600;700;800"],
  },
  classic: {
    label: "Classic — established & trusted (Playfair Display + Lora)",
    heading: `'Playfair Display', Georgia, serif`,
    body: `'Lora', Georgia, serif`,
    google: ["Playfair+Display:wght@500;600;700", "Lora:wght@400;500;600"],
  },
  bold: {
    label: "Bold — loud & proud (Archivo + Inter)",
    heading: `'Archivo', 'Inter', sans-serif`,
    body: `'Inter', Helvetica, sans-serif`,
    google: ["Archivo:wght@600;700;800;900", "Inter:wght@400;500;600"],
  },
  warm: {
    label: "Warm — soft & hopeful (Quicksand + Karla)",
    heading: `'Quicksand', 'Karla', sans-serif`,
    body: `'Karla', Verdana, sans-serif`,
    google: ["Quicksand:wght@500;600;700", "Karla:wght@400;500;700"],
  },
};

export const WORDMARK_FONTS: Record<string, { label: string; css: string; google: string }> = {
  fredoka: { label: "Fredoka (round)", css: `'Fredoka', sans-serif`, google: "Fredoka:wght@400;500;600;700" },
  playfair: { label: "Playfair (serif)", css: `'Playfair Display', serif`, google: "Playfair+Display:wght@500;600;700;800" },
  archivo: { label: "Archivo (block)", css: `'Archivo', sans-serif`, google: "Archivo:wght@600;700;800;900" },
  quicksand: { label: "Quicksand (soft)", css: `'Quicksand', sans-serif`, google: "Quicksand:wght@500;600;700" },
  caveat: { label: "Caveat (handwritten)", css: `'Caveat', cursive`, google: "Caveat:wght@500;600;700" },
};

export const DEFAULT_BRAND: Brand = {
  palette: { primary: "#2e7d54", accent: "#4caf7d", ink: "#2e2a26", bg: "#fff9f0" },
  logo: { kind: "wordmark", imageUrl: null },
  wordmark: { font: "fredoka", case: "title", tracking: 0, weight: 600 },
  typography: "friendly",
  tagline: "",
  voice: "Warm, plain, and joyful. Animals are friends, never inventory.",
  accent: "#4caf7d",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function safeHex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback;
}

export function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function pickKey(v: unknown, allowed: Record<string, unknown>, fallback: string): string {
  return typeof v === "string" && v in allowed ? v : fallback;
}

/** Parse + whitelist any brand JSON (user- or model-produced). Never throws. */
export function validateBrand(raw: unknown): Brand {
  const d = DEFAULT_BRAND;
  if (!raw || typeof raw !== "object") return structuredClone(d);
  const b = raw as Record<string, unknown>;
  const pal = (b.palette && typeof b.palette === "object" ? b.palette : {}) as Record<string, unknown>;
  const wm = (b.wordmark && typeof b.wordmark === "object" ? b.wordmark : {}) as Record<string, unknown>;
  const logo = (b.logo && typeof b.logo === "object" ? b.logo : {}) as Record<string, unknown>;

  const palette: BrandPalette = {
    primary: safeHex(pal.primary, d.palette.primary),
    accent: safeHex(pal.accent ?? b.accent, d.palette.accent),
    ink: safeHex(pal.ink, d.palette.ink),
    bg: safeHex(pal.bg, d.palette.bg),
  };
  const imageUrl =
    typeof logo.imageUrl === "string" && /^\/api\/media\/[\w\-./]+$/.test(logo.imageUrl)
      ? logo.imageUrl
      : null;
  return {
    palette,
    logo: { kind: logo.kind === "image" && imageUrl ? "image" : "wordmark", imageUrl },
    wordmark: {
      font: pickKey(wm.font, WORDMARK_FONTS, d.wordmark.font),
      case: wm.case === "upper" || wm.case === "lower" ? wm.case : "title",
      tracking: clampNum(wm.tracking, -50, 300, d.wordmark.tracking),
      weight: clampNum(wm.weight, 400, 800, d.wordmark.weight),
    },
    typography: pickKey(b.typography, FONT_PAIRS, d.typography),
    tagline: typeof b.tagline === "string" ? b.tagline.slice(0, 200) : "",
    voice: typeof b.voice === "string" && b.voice.trim() ? b.voice.slice(0, 500) : d.voice,
    accent: palette.accent,
  };
}

export function parseBrandJson(json: string | null): Brand {
  if (!json) return structuredClone(DEFAULT_BRAND);
  try {
    return validateBrand(JSON.parse(json));
  } catch {
    return structuredClone(DEFAULT_BRAND);
  }
}

/** Google Fonts stylesheet URL for a brand (pair + wordmark font). */
export function brandFontsHref(brand: Brand): string {
  const fams = new Set<string>(FONT_PAIRS[brand.typography]?.google ?? FONT_PAIRS.friendly.google);
  const wm = WORDMARK_FONTS[brand.wordmark.font];
  if (wm) fams.add(wm.google);
  return `https://fonts.googleapis.com/css2?${[...fams].map((f) => `family=${f}`).join("&")}&display=swap`;
}

export function wordmarkText(name: string, brand: Brand): string {
  if (brand.wordmark.case === "upper") return name.toUpperCase();
  if (brand.wordmark.case === "lower") return name.toLowerCase();
  return name;
}

export function wordmarkStyle(brand: Brand): Record<string, string | number> {
  return {
    fontFamily: WORDMARK_FONTS[brand.wordmark.font]?.css ?? WORDMARK_FONTS.fredoka.css,
    fontWeight: brand.wordmark.weight,
    letterSpacing: `${brand.wordmark.tracking / 1000}em`,
    color: brand.palette.primary,
  };
}

// ---------------------------------------------------------------------------
// Old-website import: scrape name / logo / colors from fetched homepage HTML.
// Everything extracted is untrusted text — callers must escape on render.
// ---------------------------------------------------------------------------

export interface ScrapedSite {
  name: string | null;
  logoUrl: string | null;
  colors: string[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function absolutize(url: string, base: string): string | null {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

export function scrapeHomepage(html: string, baseUrl: string): ScrapedSite {
  const head = html.slice(0, 200_000);
  const meta = (name: string, attr = "property") => {
    const m =
      head.match(new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
      head.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["']`, "i"));
    return m ? decodeEntities(m[1]).trim() : null;
  };

  const name =
    meta("og:site_name") ??
    meta("og:title") ??
    (head.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1] ?? null)?.split(/\s*[|–—-]\s*/)[0]?.trim() ??
    null;

  let logoUrl: string | null = null;
  const iconMatch = head.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    ?? head.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  const ogImage = meta("og:image");
  const headerImg = html.match(/<header[^>]*>[\s\S]{0,2000}?<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
  for (const cand of [headerImg, ogImage, iconMatch?.[1]]) {
    if (cand) {
      logoUrl = absolutize(decodeEntities(cand), baseUrl);
      if (logoUrl) break;
    }
  }

  const colors: string[] = [];
  const themeColor = meta("theme-color", "name");
  if (themeColor && HEX.test(themeColor)) colors.push(themeColor.toLowerCase());
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/(?:color|background(?:-color)?)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
    const c = m[1].toLowerCase();
    // skip near-white/near-black — they're page scaffolding, not brand
    const v = parseInt(c.slice(1), 16);
    const r = v >> 16, g = (v >> 8) & 255, bl = v & 255;
    const lum = (r + g + bl) / 3;
    if (lum > 240 || lum < 24) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  for (const [c] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    if (!colors.includes(c)) colors.push(c);
  }
  return { name: name?.slice(0, 120) ?? null, logoUrl, colors: colors.slice(0, 4) };
}
