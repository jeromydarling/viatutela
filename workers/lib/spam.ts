/**
 * Lightweight spam scoring for public forms (the contact form especially).
 *
 * The reality of a shelter contact form: real messages are people asking
 * about adopting, migrating data, or pricing. They almost never contain
 * links, SEO pitches, or crypto. Bots that fill the honeypot's siblings
 * are still trivially separable by CONTENT, so we score the content and
 * silently drop anything that reeks — the sender gets the same "thanks!"
 * either way, so bots never learn they were filtered.
 */

// phrases that essentially never appear in a genuine shelter inquiry but
// dominate the SEO / marketing / crypto spam that hits contact forms
const SPAM_PHRASES = [
  "search index",
  "search engine",
  "search results",
  "google's search",
  "google search console",
  "first page of google",
  "rank higher",
  "ranking",
  "seo",
  "backlink",
  "back link",
  "web traffic",
  "website traffic",
  "boost your",
  "grow your business",
  "increase sales",
  "increase your",
  "guest post",
  "link building",
  "digital marketing",
  "marketing services",
  "web design services",
  "lead generation",
  "get more customers",
  "crypto",
  "bitcoin",
  "forex",
  "investment opportunity",
  "make money",
  "work from home",
  "become visible",
  "be visible in online",
  "add your website",
  "submit your site",
  "list your business",
  "get indexed",
];

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|pro|biz|info|site|online|xyz|shop|store|club|link|click|top|live)\b/gi;

export interface SpamSignals {
  score: number;
  reasons: string[];
}

/**
 * Score a contact submission. ≥ SPAM_THRESHOLD is treated as spam.
 * Pure and deterministic — unit-tested against real samples.
 */
export function scoreSpam(input: { name: string; email: string; message: string }): SpamSignals {
  const reasons: string[] = [];
  let score = 0;
  const msg = input.message.toLowerCase();
  const hay = `${input.name} ${input.message}`.toLowerCase();

  // links in a contact message are the single strongest signal
  const urls = input.message.match(URL_RE) ?? [];
  if (urls.length >= 1) {
    score += 2;
    reasons.push(`contains ${urls.length} link(s)`);
    if (urls.length >= 2) score += 1;
  }

  // spam phrases
  let phraseHits = 0;
  for (const phrase of SPAM_PHRASES) {
    if (hay.includes(phrase)) phraseHits++;
  }
  if (phraseHits > 0) {
    score += phraseHits >= 2 ? 3 : 2;
    reasons.push(`${phraseHits} pitch phrase(s)`);
  }

  // sender impersonating our own domain (e.g. domains@search-viatutela.pet)
  const domain = input.email.split("@")[1] ?? "";
  if (domain.includes("viatutela") && domain !== "viatutela.pet") {
    score += 3;
    reasons.push("look-alike sender domain");
  }

  // greeting-bot tells
  if (/^(greetings|dear (sir|madam|owner|webmaster)|hello there,? i)/i.test(input.message.trim())) {
    score += 1;
    reasons.push("form-letter opener");
  }

  // ALL-CAPS shouting in a longer message
  const letters = input.message.replace(/[^a-z]/gi, "");
  if (letters.length > 30 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6) {
    score += 1;
    reasons.push("mostly uppercase");
  }

  // a very short message that's mostly a link
  if (msg.length < 200 && urls.length >= 1 && phraseHits >= 1) {
    score += 1;
    reasons.push("short link-pitch");
  }

  return { score, reasons };
}

export const SPAM_THRESHOLD = 3;

export function isSpam(input: { name: string; email: string; message: string }): boolean {
  return scoreSpam(input).score >= SPAM_THRESHOLD;
}
