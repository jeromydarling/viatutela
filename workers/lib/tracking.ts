/**
 * Analytics for shelter public sites — IDs only, never raw code.
 *
 * Shelters paste the measurement ID from a short whitelist of popular
 * trackers; we validate it against a strict format and render the
 * official snippet ourselves. Nothing a shelter types is ever emitted
 * as markup, so there is no path from this feature to injected script.
 */

export interface TrackingSettings {
  ga4: string;
  gtm: string;
  meta_pixel: string;
  plausible: string;
}

export const EMPTY_TRACKING: TrackingSettings = { ga4: "", gtm: "", meta_pixel: "", plausible: "" };

interface TrackerField {
  key: keyof TrackingSettings;
  label: string;
  hint: string;
  placeholder: string;
  pattern: RegExp;
  normalize: (raw: string) => string;
}

export const TRACKER_FIELDS: TrackerField[] = [
  {
    key: "ga4",
    label: "Google Analytics 4",
    hint: "Measurement ID — starts with G-, found under Admin → Data streams.",
    placeholder: "G-XXXXXXXXXX",
    pattern: /^G-[A-Z0-9]{4,16}$/,
    normalize: (raw) => raw.trim().toUpperCase(),
  },
  {
    key: "gtm",
    label: "Google Tag Manager",
    hint: "Container ID — starts with GTM-, shown at the top of your Tag Manager workspace.",
    placeholder: "GTM-XXXXXXX",
    pattern: /^GTM-[A-Z0-9]{4,10}$/,
    normalize: (raw) => raw.trim().toUpperCase(),
  },
  {
    key: "meta_pixel",
    label: "Meta (Facebook) Pixel",
    hint: "Pixel ID — a long number, found in Meta Events Manager.",
    placeholder: "1234567890123456",
    pattern: /^[0-9]{8,20}$/,
    normalize: (raw) => raw.trim(),
  },
  {
    key: "plausible",
    label: "Plausible Analytics",
    hint: "The domain you registered in Plausible, e.g. sunnymeadow.org.",
    placeholder: "yourshelter.org",
    pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    normalize: (raw) => raw.trim().toLowerCase(),
  },
];

/**
 * Validate raw form/JSON values into safe tracking settings.
 * Invalid entries produce a friendly error and are dropped — a value
 * that doesn't match its whitelist pattern never reaches storage or HTML.
 */
export function validateTracking(raw: Record<string, unknown>): {
  tracking: TrackingSettings;
  errors: string[];
} {
  const tracking: TrackingSettings = { ...EMPTY_TRACKING };
  const errors: string[] = [];
  for (const field of TRACKER_FIELDS) {
    const value = raw[field.key];
    if (typeof value !== "string") continue;
    const cleaned = field.normalize(value.slice(0, 200));
    if (!cleaned) continue;
    if (field.pattern.test(cleaned)) {
      tracking[field.key] = cleaned;
    } else {
      errors.push(`${field.label}: "${value.trim().slice(0, 60)}" doesn't look like a valid ID (expected something like ${field.placeholder}).`);
    }
  }
  return { tracking, errors };
}

export function hasTracking(t: TrackingSettings): boolean {
  return Boolean(t.ga4 || t.gtm || t.meta_pixel || t.plausible);
}
