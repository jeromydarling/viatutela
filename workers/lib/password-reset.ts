/**
 * Self-service password reset + password-change security notices.
 *
 * Security posture:
 * - Reset tokens are random 48-hex strings; only their SHA-256 hash is
 *   stored, so a DB leak can't be replayed.
 * - Tokens expire in 1 hour and are single-use (used_at stamped).
 * - Requesting a reset NEVER reveals whether an email has an account
 *   (no enumeration) — the route always shows the same "check your
 *   inbox" message.
 * - Any password change (reset OR in-app) invalidates every existing
 *   session for that user and sends a "your password changed" notice.
 */

import { newId, newToken } from "./ids";
import { hashPassword } from "./password";
import { sendAppEmail } from "./email";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isResetTokenFormat(token: string): boolean {
  return /^[a-f0-9]{48}$/.test(token);
}

/**
 * Begin a reset. Always returns quietly (no enumeration). Sends the email
 * only when the address actually maps to a password-bearing account.
 */
export async function requestPasswordReset(env: Env, rawEmail: string, origin: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
  const user = await env.DB.prepare(
    `SELECT u.id, u.name, o.name org_name FROM users u JOIN orgs o ON o.id = u.org_id
     WHERE u.email = ? AND u.password_hash IS NOT NULL`,
  )
    .bind(email)
    .first<{ id: string; name: string | null; org_name: string }>();
  if (!user) return;

  const token = newToken();
  const expires = new Date(Date.now() + RESET_TTL_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(newId("pr"), user.id, await hashToken(token), expires)
    .run();

  await sendAppEmail(env, {
    to: email,
    subject: "Reset your Tutela password 🔑",
    heading: "Let's get you back in",
    paragraphs: [
      `Someone (hopefully you) asked to reset the password for your ${user.org_name} account on Tutela.`,
      "Tap the button below to choose a new one. This link works once and expires in an hour.",
      "Didn't ask for this? You can safely ignore this email — your password won't change unless you use the link.",
    ],
    cta: { label: "Choose a new password", url: `${origin}/reset/${token}` },
  });
}

export interface ResetTokenUser {
  userId: string;
  email: string;
  orgName: string;
}

/** Resolve a live, unused, unexpired token to its user. */
export async function resolveResetToken(env: Env, token: string): Promise<ResetTokenUser | null> {
  if (!isResetTokenFormat(token)) return null;
  const row = await env.DB.prepare(
    `SELECT pr.user_id, u.email, o.name org_name
     FROM password_resets pr JOIN users u ON u.id = pr.user_id JOIN orgs o ON o.id = u.org_id
     WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > datetime('now')`,
  )
    .bind(await hashToken(token))
    .first<{ user_id: string; email: string; org_name: string }>();
  if (!row) return null;
  return { userId: row.user_id, email: row.email, orgName: row.org_name };
}

/**
 * Complete a reset: set the new password, burn the token, kill all
 * sessions, and send the security confirmation. Returns false if the
 * token is no longer valid (raced or expired between load and submit).
 */
export async function completePasswordReset(
  env: Env,
  token: string,
  newPassword: string,
  origin: string,
): Promise<boolean> {
  const resolved = await resolveResetToken(env, token);
  if (!resolved) return false;
  const { hash, salt } = await hashPassword(newPassword);
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`)
      .bind(hash, salt, resolved.userId),
    env.DB.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?`)
      .bind(await hashToken(token)),
    // one reset also spends any other outstanding tokens for this user
    env.DB.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`)
      .bind(resolved.userId),
    // sign out everywhere — a reset means "lock the doors and rekey"
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(resolved.userId),
  ]);
  await sendPasswordChangedNotice(env, resolved.email, resolved.orgName, origin, true);
  return true;
}

/** "Your password was changed" — sent after both reset and in-app change. */
export async function sendPasswordChangedNotice(
  env: Env,
  email: string,
  orgName: string,
  origin: string,
  fromReset: boolean,
): Promise<void> {
  await sendAppEmail(env, {
    to: email,
    subject: "Your Tutela password was changed 🔒",
    heading: "Password updated",
    paragraphs: [
      `The password for your ${orgName} account on Tutela was just ${fromReset ? "reset" : "changed"}.`,
      "If this was you, you're all set — nothing else to do.",
      "If this WASN'T you, reset your password right away and let us know: your account may need attention.",
    ],
    cta: { label: "Reset your password", url: `${origin}/forgot` },
  });
}

/** Housekeeping: resets are short-lived; prune the stale rows. */
export async function pruneExpiredResets(env: Env): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM password_resets WHERE expires_at < datetime('now', '-2 days')`,
  ).run();
}
