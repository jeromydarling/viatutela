/**
 * Supporter email — sending a campaign's email asset to the shelter's
 * subscriber contacts, the polite way:
 *
 * - HMAC unsubscribe tokens (email + org + server secret) — no DB lookup
 *   needed to verify, no guessable URLs.
 * - A per-org suppression table checked before EVERY send.
 * - List-Unsubscribe + one-click headers on every message.
 *
 * Adaptation note: volume here is newsletter-sized (hundreds, not
 * millions), so sends drain inline via ctx.waitUntil in small batches
 * rather than through a cron outbox; sendAppEmail already never throws.
 */

import { sendAppEmail } from "./email";

const enc = new TextEncoder();

async function getSecret(env: Env): Promise<string> {
  const configured = (env as unknown as { UNSUB_SECRET?: string }).UNSUB_SECRET;
  if (configured) return configured;
  // persistent random fallback so tokens stay valid across deploys
  const existing = await env.CONFIG.get("unsub_secret");
  if (existing) return existing;
  const fresh = crypto.randomUUID() + crypto.randomUUID();
  await env.CONFIG.put("unsub_secret", fresh);
  return fresh;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string | null {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

export async function makeUnsubToken(env: Env, orgId: string, email: string): Promise<string> {
  const secret = await getSecret(env);
  const mac = await hmacHex(secret, `${orgId}:${email.toLowerCase()}`);
  return `${b64urlEncode(email.toLowerCase())}.${b64urlEncode(orgId)}.${mac.slice(0, 32)}`;
}

/** Verify a token; returns the (org, email) pair it grants, or null. */
export async function verifyUnsubToken(env: Env, token: string): Promise<{ orgId: string; email: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const email = b64urlDecode(parts[0]);
  const orgId = b64urlDecode(parts[1]);
  if (!email || !orgId || !/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  const secret = await getSecret(env);
  const expect = (await hmacHex(secret, `${orgId}:${email.toLowerCase()}`)).slice(0, 32);
  if (expect !== parts[2]) return null;
  return { orgId, email: email.toLowerCase() };
}

export async function suppress(env: Env, orgId: string, email: string, reason = "unsubscribed"): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO email_suppression (org_id, email, reason) VALUES (?, ?, ?)
     ON CONFLICT(org_id, email) DO NOTHING`,
  )
    .bind(orgId, email.toLowerCase(), reason)
    .run();
}

/** Pure: drop suppressed/invalid/duplicate recipients. Unit-tested. */
export function filterRecipients(
  contacts: { name: string; email: string | null }[],
  suppressed: Set<string>,
): { name: string; email: string }[] {
  const seen = new Set<string>();
  const out: { name: string; email: string }[] = [];
  for (const c of contacts) {
    const email = (c.email ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) continue;
    if (suppressed.has(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({ name: c.name, email });
  }
  return out;
}

export interface SupporterSendResult {
  attempted: number;
  skippedSuppressed: number;
}

/**
 * Send one email asset to the org's supporters (newsletter + donor roles).
 * Returns counts; actual delivery is best-effort per sendAppEmail.
 */
export async function sendSupporterEmail(
  env: Env,
  args: {
    orgId: string;
    orgName: string;
    orgEmail: string | null;
    subject: string;
    body: string; // plain text with {{SITE_URL}} placeholders
    siteUrl: string;
    appOrigin: string;
  },
): Promise<SupporterSendResult> {
  const contacts = await env.DB.prepare(
    `SELECT name, email FROM contacts
     WHERE org_id = ? AND email IS NOT NULL AND (roles LIKE '%newsletter%' OR roles LIKE '%donor%')
     LIMIT 2000`,
  )
    .bind(args.orgId)
    .all<{ name: string; email: string | null }>();
  const sup = await env.DB.prepare(`SELECT email FROM email_suppression WHERE org_id = ?`)
    .bind(args.orgId)
    .all<{ email: string }>();
  const suppressed = new Set(sup.results.map((r) => r.email));
  const before = contacts.results.length;
  const recipients = filterRecipients(contacts.results, suppressed);

  const body = args.body.replaceAll("{{SITE_URL}}", args.siteUrl);
  let attempted = 0;
  for (const r of recipients) {
    const token = await makeUnsubToken(env, args.orgId, r.email);
    const unsubUrl = `${args.appOrigin}/unsub/${token}`;
    await sendAppEmail(env, {
      to: r.email,
      subject: args.subject,
      heading: args.subject,
      paragraphs: [...body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean), `—`, `You're getting this because you support ${args.orgName}. Unsubscribe any time: ${unsubUrl}`],
      ...(args.orgEmail ? { replyTo: args.orgEmail } : {}),
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    attempted++;
  }
  return { attempted, skippedSuppressed: before - recipients.length };
}
