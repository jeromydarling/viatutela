/**
 * Block CMS section model.
 *
 * Section types are a CLOSED enum; per-type fields stay OPEN (passthrough).
 * Adding a section type never needs a migration; garbage types can't get in.
 * Caps: max 40 sections per page, 120KB serialized.
 */

export const SECTION_TYPES = [
  "home_hero",
  "hero",
  "prose",
  "image_text",
  "adoptable_grid",
  "success_stories",
  "gallery",
  "quote",
  "faq",
  "cta_band",
  "events_strip",
  "newsletter_signup",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export interface Section {
  type: SectionType;
  [key: string]: unknown;
}

export const MAX_SECTIONS = 40;
export const MAX_SECTIONS_BYTES = 120 * 1024;

export interface SectionValidation {
  ok: boolean;
  sections: Section[];
  error?: string;
}

/** Validate an unknown value as a section stack. Loose blocks, hard shell. */
export function validateSections(input: unknown): SectionValidation {
  if (!Array.isArray(input)) return { ok: false, sections: [], error: "sections must be an array" };
  if (input.length > MAX_SECTIONS) {
    return { ok: false, sections: [], error: `too many sections (max ${MAX_SECTIONS})` };
  }
  const out: Section[] = [];
  for (let i = 0; i < input.length; i++) {
    const s = input[i];
    if (typeof s !== "object" || s === null || Array.isArray(s)) {
      return { ok: false, sections: [], error: `section ${i + 1} is not an object` };
    }
    const type = (s as Record<string, unknown>).type;
    if (typeof type !== "string" || !SECTION_TYPES.includes(type as SectionType)) {
      return { ok: false, sections: [], error: `section ${i + 1} has unknown type "${String(type)}"` };
    }
    out.push(s as Section);
  }
  const serialized = JSON.stringify(out);
  if (serialized.length > MAX_SECTIONS_BYTES) {
    return { ok: false, sections: [], error: `page is too large (${Math.round(serialized.length / 1024)}KB, max 120KB)` };
  }
  return { ok: true, sections: out };
}

export function parseSectionsJson(json: string | null | undefined): Section[] {
  if (!json) return [];
  try {
    const v = validateSections(JSON.parse(json));
    return v.ok ? v.sections : [];
  } catch {
    return [];
  }
}

/* ---------- editor field definitions (drives the admin forms) ---------- */

export interface FieldDef {
  name: string;
  label: string;
  kind: "text" | "textarea" | "image" | "select" | "number";
  options?: string[];
  placeholder?: string;
}

export interface ItemDef {
  label: string; // singular, e.g. "question"
  fields: FieldDef[];
}

export interface SectionDef {
  type: SectionType;
  label: string;
  hint: string;
  fields: FieldDef[];
  items?: ItemDef;
}

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "home_hero",
    label: "Big welcome (hero)",
    hint: "The big warm opener at the top of the homepage.",
    fields: [
      { name: "eyebrow", label: "Small line above the heading", kind: "text", placeholder: "A rescue in Assisi Springs" },
      { name: "heading", label: "Heading", kind: "text", placeholder: "Every animal deserves a way home." },
      { name: "sub", label: "Subheading", kind: "textarea" },
      { name: "cta_label", label: "Button label", kind: "text", placeholder: "Meet the animals" },
      { name: "cta_href", label: "Button link", kind: "text", placeholder: "/adopt" },
      { name: "image_url", label: "Image", kind: "image" },
    ],
  },
  {
    type: "hero",
    label: "Page header",
    hint: "A simpler heading + image for inner pages.",
    fields: [
      { name: "heading", label: "Heading", kind: "text" },
      { name: "sub", label: "Subheading", kind: "textarea" },
      { name: "image_url", label: "Image", kind: "image" },
    ],
  },
  {
    type: "prose",
    label: "Text",
    hint: "Paragraphs with **bold**, *italics*, [links](https://…), ## headings and - lists.",
    fields: [{ name: "md", label: "Text", kind: "textarea" }],
  },
  {
    type: "image_text",
    label: "Image + text",
    hint: "A picture beside a story.",
    fields: [
      { name: "image_url", label: "Image", kind: "image" },
      { name: "alt", label: "Image description (alt text)", kind: "text" },
      { name: "heading", label: "Heading", kind: "text" },
      { name: "md", label: "Text", kind: "textarea" },
      { name: "image_side", label: "Image side", kind: "select", options: ["left", "right"] },
    ],
  },
  {
    type: "adoptable_grid",
    label: "Adoptable animals (live)",
    hint: "Pulls your current adoptable friends automatically — never goes stale.",
    fields: [
      { name: "heading", label: "Heading", kind: "text", placeholder: "Looking for a home" },
      { name: "species", label: "Only this species (blank = all)", kind: "text", placeholder: "dog" },
      { name: "limit", label: "How many to show", kind: "number", placeholder: "6" },
    ],
  },
  {
    type: "success_stories",
    label: "Success stories",
    hint: "Happy endings worth telling.",
    fields: [{ name: "heading", label: "Heading", kind: "text", placeholder: "Gone home" }],
    items: {
      label: "story",
      fields: [
        { name: "image_url", label: "Photo", kind: "image" },
        { name: "title", label: "Title", kind: "text", placeholder: "Biscuit, adopted June 2026" },
        { name: "text", label: "Story", kind: "textarea" },
      ],
    },
  },
  {
    type: "gallery",
    label: "Photo gallery",
    hint: "A grid of photos.",
    fields: [{ name: "heading", label: "Heading", kind: "text" }],
    items: {
      label: "photo",
      fields: [
        { name: "image_url", label: "Photo", kind: "image" },
        { name: "alt", label: "Description (alt text)", kind: "text" },
      ],
    },
  },
  {
    type: "quote",
    label: "Quote",
    hint: "A testimonial or kind word.",
    fields: [
      { name: "text", label: "Quote", kind: "textarea" },
      { name: "attribution", label: "Who said it", kind: "text" },
    ],
  },
  {
    type: "faq",
    label: "Questions & answers",
    hint: "The things people always ask.",
    fields: [{ name: "heading", label: "Heading", kind: "text", placeholder: "Good questions" }],
    items: {
      label: "question",
      fields: [
        { name: "q", label: "Question", kind: "text" },
        { name: "a", label: "Answer", kind: "textarea" },
      ],
    },
  },
  {
    type: "cta_band",
    label: "Call-to-action band",
    hint: "Donate / volunteer / foster — the big colorful ask.",
    fields: [
      { name: "heading", label: "Heading", kind: "text", placeholder: "Lend a paw" },
      { name: "text", label: "Text", kind: "textarea" },
      { name: "primary_label", label: "Primary button label", kind: "text", placeholder: "Donate" },
      { name: "primary_href", label: "Primary button link", kind: "text" },
      { name: "secondary_label", label: "Secondary button label", kind: "text", placeholder: "Volunteer" },
      { name: "secondary_href", label: "Secondary button link", kind: "text" },
    ],
  },
  {
    type: "events_strip",
    label: "Events",
    hint: "Adoption days, fundraisers, clinics.",
    fields: [{ name: "heading", label: "Heading", kind: "text", placeholder: "Come say hello" }],
    items: {
      label: "event",
      fields: [
        { name: "date", label: "Date", kind: "text", placeholder: "Sat Aug 2, 10am" },
        { name: "title", label: "Event", kind: "text" },
        { name: "place", label: "Where", kind: "text" },
        { name: "text", label: "Details", kind: "textarea" },
      ],
    },
  },
  {
    type: "newsletter_signup",
    label: "Newsletter signup",
    hint: "Collect emails from supporters (they land in People as subscribers).",
    fields: [
      { name: "heading", label: "Heading", kind: "text", placeholder: "Stay close to the pack" },
      { name: "text", label: "Text", kind: "textarea" },
    ],
  },
];

export const SECTION_DEF_BY_TYPE = Object.fromEntries(
  SECTION_DEFS.map((d) => [d.type, d]),
) as Record<SectionType, SectionDef>;
