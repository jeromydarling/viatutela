/**
 * The Search & AI Review — a graded, Lovable-style audit of a shelter's
 * public website. Pure and fully testable: the loader gathers the facts
 * from D1 and known rendering behavior, this turns them into scored
 * checks. We only claim a "pass" for things Tutela genuinely does.
 *
 * Statuses, in the order the UI shows them:
 *   warn    — a real problem worth fixing (orange)
 *   suggest — an opportunity, not a fault (blue)
 *   pass    — handled for you (green, muted)
 */

export type CheckStatus = "warn" | "suggest" | "pass";

export interface AuditCheck {
  id: string;
  group: string;
  status: CheckStatus;
  title: string;
  detail: string;
  fix?: { label: string; to: string };
}

export const AUDIT_GROUPS = [
  "Findability",
  "Page quality",
  "Content & accessibility",
  "AI & performance",
] as const;

export interface AuditInput {
  visible: boolean;
  googleVerify: boolean;
  bingVerify: boolean;
  defaultOgImage: boolean;
  publishedPages: number;
  hasHomePage: boolean;
  pagesMissingMeta: number; // published pages with no meta description
  pagesLongTitle: number; // meta_title or title > 60 chars
  pagesLongMeta: number; // meta_description > 160 chars
  pagesNoSocialImage: number; // no hero image and no default og image
  adoptableTotal: number;
  animalsNoPhoto: number;
  animalsNoBio: number;
  photosNoAlt: number;
  domainActive: boolean;
  domainPending: boolean;
}

const TITLE_MAX = 60;
const META_MAX = 160;

export function runAudit(input: AuditInput): AuditCheck[] {
  const checks: AuditCheck[] = [];
  const push = (c: AuditCheck) => checks.push(c);

  // ---------------------------------------------------------- Findability
  if (!input.visible) {
    push({
      id: "crawlers",
      group: "Findability",
      status: "warn",
      title: "Crawler rules are blocking search engines",
      detail:
        "Your site is set to hidden, so every page tells Google and other engines not to index it. Perfect before launch — but flip visibility on when you're ready to be found.",
      fix: { label: "Turn on search visibility", to: "/app/website/seo" },
    });
  } else {
    push({
      id: "crawlers",
      group: "Findability",
      status: "pass",
      title: "Crawler rules welcome search engines",
      detail: "Your robots.txt allows crawling and your pages are indexable.",
    });
  }

  if (input.publishedPages === 0) {
    push({
      id: "sitemap",
      group: "Findability",
      status: "warn",
      title: "Your sitemap is empty",
      detail:
        "A sitemap lists your pages for search engines, but you haven't published any yet. Publish your site and the sitemap fills itself in.",
      fix: { label: "Publish your site", to: "/app/website" },
    });
  } else {
    push({
      id: "sitemap",
      group: "Findability",
      status: "pass",
      title: "Sitemap is generated automatically",
      detail: `${input.publishedPages} published page${input.publishedPages === 1 ? "" : "s"} plus every adoptable friend appear in your sitemap.xml — submit it once in Search Console.`,
    });
  }

  if (!input.googleVerify) {
    push({
      id: "gsc",
      group: "Findability",
      status: "warn",
      title: "Google Search Console isn't verified",
      detail:
        "Search Console is free and shows you exactly what Google sees — searches, clicks, and any crawl issues. Paste the verification value on the SEO page, then submit your sitemap.",
      fix: { label: "Add your verification code", to: "/app/website/seo" },
    });
  } else {
    push({
      id: "gsc",
      group: "Findability",
      status: "pass",
      title: "Google Search Console verified",
      detail: "Your verification meta tag is in place. Submit your sitemap in Search Console if you haven't yet.",
    });
  }

  if (input.domainActive) {
    push({
      id: "domain",
      group: "Findability",
      status: "pass",
      title: "Custom domain connected",
      detail: "Your site lives on your own domain with automatic SSL — the most trustworthy address for adopters and search engines.",
    });
  } else if (input.domainPending) {
    push({
      id: "domain",
      group: "Findability",
      status: "suggest",
      title: "Custom domain is almost ready",
      detail: "Your domain is connected but still finishing DNS and SSL. Once it's active it becomes your site's primary address.",
      fix: { label: "Check domain status", to: "/app/website/domain" },
    });
  } else {
    push({
      id: "domain",
      group: "Findability",
      status: "suggest",
      title: "Connect your own domain",
      detail: "A yourshelter.org address builds trust and is easier to share than a subpath. Point one CNAME and SSL is automatic.",
      fix: { label: "Connect a domain", to: "/app/website/domain" },
    });
  }

  // --------------------------------------------------------- Page quality
  if (input.pagesMissingMeta > 0) {
    push({
      id: "meta-desc",
      group: "Page quality",
      status: "warn",
      title: `${input.pagesMissingMeta} page${input.pagesMissingMeta === 1 ? "" : "s"} missing a search description`,
      detail:
        "The meta description is the sentence under your title in search results. Without one, Google guesses. The ✨ AI button on each page drafts these for you.",
      fix: { label: "Fix your pages", to: "/app/website" },
    });
  } else if (input.publishedPages > 0) {
    push({
      id: "meta-desc",
      group: "Page quality",
      status: "pass",
      title: "Every page has a search description",
      detail: "Each published page tells search engines what it's about in its own words.",
    });
  }

  if (input.pagesLongTitle > 0 || input.pagesLongMeta > 0) {
    push({
      id: "length",
      group: "Page quality",
      status: "suggest",
      title: "Some titles or descriptions run long",
      detail:
        `Search engines truncate titles past ~${TITLE_MAX} characters and descriptions past ~${META_MAX}. Trimming them keeps your best words visible in results.`,
      fix: { label: "Tighten them up", to: "/app/website" },
    });
  } else if (input.publishedPages > 0) {
    push({
      id: "length",
      group: "Page quality",
      status: "pass",
      title: "Titles and descriptions are well-sized",
      detail: "Nothing will get cut off in search results.",
    });
  }

  if (input.pagesNoSocialImage > 0 && !input.defaultOgImage) {
    push({
      id: "social",
      group: "Page quality",
      status: "suggest",
      title: "Social previews aren't page-specific",
      detail:
        "When someone shares your site, pages without a hero image fall back to a generic preview. Add hero images, or set a default share image on the SEO page.",
      fix: { label: "Set a default share image", to: "/app/website/seo" },
    });
  } else {
    push({
      id: "social",
      group: "Page quality",
      status: "pass",
      title: "Social previews look sharp",
      detail: "Shared links unfurl with a real image, title, and description.",
    });
  }

  // ----------------------------------------------- Content & accessibility
  if (input.animalsNoPhoto > 0) {
    push({
      id: "animal-photos",
      group: "Content & accessibility",
      status: "warn",
      title: `${input.animalsNoPhoto} adoptable friend${input.animalsNoPhoto === 1 ? "" : "s"} without a photo`,
      detail: "Animals with photos get dramatically more clicks — and adopted faster. A photo is the single biggest lever on an adoption page.",
      fix: { label: "Add their photos", to: "/app/animals" },
    });
  } else if (input.adoptableTotal > 0) {
    push({
      id: "animal-photos",
      group: "Content & accessibility",
      status: "pass",
      title: "Every adoptable friend has a photo",
      detail: "The fastest path to a click and an adoption.",
    });
  }

  if (input.animalsNoBio > 0) {
    push({
      id: "animal-bios",
      group: "Content & accessibility",
      status: "warn",
      title: `${input.animalsNoBio} adoptable friend${input.animalsNoBio === 1 ? "" : "s"} without a real bio`,
      detail: "A real story helps adopters and gives search engines something to index. The ✨ AI bio writer turns two facts into a great one.",
      fix: { label: "Write their bios", to: "/app/animals" },
    });
  } else if (input.adoptableTotal > 0) {
    push({
      id: "animal-bios",
      group: "Content & accessibility",
      status: "pass",
      title: "Every adoptable friend has a real bio",
      detail: "Good for adopters, and good for search.",
    });
  }

  if (input.photosNoAlt > 0) {
    push({
      id: "alt-text",
      group: "Content & accessibility",
      status: "suggest",
      title: `${input.photosNoAlt} photo${input.photosNoAlt === 1 ? "" : "s"} without descriptive alt text`,
      detail:
        "Alt text lets screen-reader users and search engines understand your photos. The ✨ photo review on each profile writes it automatically.",
      fix: { label: "Review photos", to: "/app/animals" },
    });
  } else {
    push({
      id: "alt-text",
      group: "Content & accessibility",
      status: "pass",
      title: "Headings and accessibility are well-implemented",
      detail: "Proper heading order and image alt text — friendly to screen readers and search engines alike.",
    });
  }

  // ------------------------------------------------------ AI & performance
  push({
    id: "rendered",
    group: "AI & performance",
    status: "pass",
    title: "Search engines see your fully-rendered pages",
    detail: "Your site is server-rendered, so crawlers and AI assistants read complete HTML — no JavaScript required.",
  });
  push({
    id: "llms",
    group: "AI & performance",
    status: "pass",
    title: "AI assistants can read your site as markdown",
    detail: "Your site serves an llms.txt summary, so ChatGPT, Claude, and friends can describe your shelter accurately.",
  });
  push({
    id: "structured",
    group: "AI & performance",
    status: input.hasHomePage ? "pass" : "suggest",
    title: input.hasHomePage ? "AI summary and structured data are in place" : "Publish a home page for structured data",
    detail: input.hasHomePage
      ? "Your homepage carries AnimalShelter structured data (schema.org) — the backbone of local search and AI answers."
      : "Publishing a home page adds AnimalShelter structured data that powers local search and AI summaries.",
    fix: input.hasHomePage ? undefined : { label: "Publish your site", to: "/app/website" },
  });
  push({
    id: "fast",
    group: "AI & performance",
    status: "pass",
    title: "Pages load fast",
    detail: "Served from Cloudflare's edge and cached close to your visitors — speed is a ranking factor and a kindness.",
  });
  push({
    id: "mobile",
    group: "AI & performance",
    status: "pass",
    title: "Comfortable on phones",
    detail: "Your site is responsive — most adopters browse on their phones, and Google indexes the mobile version.",
  });

  return checks;
}

export interface AuditScore {
  passes: number;
  total: number;
  percent: number;
  grade: "Excellent" | "Good" | "Needs work" | "Getting started";
}

export function scoreAudit(checks: AuditCheck[]): AuditScore {
  // suggestions don't count against the score; warnings do
  const scored = checks.filter((c) => c.status !== "suggest");
  const passes = scored.filter((c) => c.status === "pass").length;
  const total = scored.length || 1;
  const percent = Math.round((passes / total) * 100);
  const grade =
    percent >= 95 ? "Excellent" : percent >= 80 ? "Good" : percent >= 55 ? "Needs work" : "Getting started";
  return { passes, total, percent, grade };
}

const ORDER: Record<CheckStatus, number> = { warn: 0, suggest: 1, pass: 2 };

/** Warnings first, then suggestions, then handled — matching the review UI. */
export function sortChecks(checks: AuditCheck[]): AuditCheck[] {
  return [...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}
