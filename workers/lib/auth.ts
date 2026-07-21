export const AUTH_COOKIE = "vt_session";

export interface AuthedUser {
  user_id: string;
  email: string;
  user_name: string | null;
  org_id: string;
  org_name: string;
  slug: string;
  plan: string;
  demo: number;
}

export async function getAuthedUser(env: Env, request: Request): Promise<AuthedUser | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${AUTH_COOKIE}=([a-f0-9]{48})`));
  if (!match) return null;
  const row = await env.DB.prepare(
    `SELECT u.id user_id, u.email, u.name user_name, o.id org_id, o.name org_name, o.slug, o.plan, o.demo
     FROM sessions s JOIN users u ON u.id = s.user_id JOIN orgs o ON o.id = u.org_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
  )
    .bind(match[1])
    .first<AuthedUser>();
  return row ?? null;
}

/** Pull the raw session token from a request's cookie, or "" if absent. */
export function sessionTokenFromRequest(request: Request): string {
  const match = (request.headers.get("cookie") ?? "").match(new RegExp(`${AUTH_COOKIE}=([a-f0-9]{48})`));
  return match ? match[1] : "";
}

export function sessionCookie(token: string, maxAge = 30 * 24 * 3600): string {
  return `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ---------- login rate limiting ----------

export const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function loginRlKey(ip: string, email: string): string {
  return `lrl:${ip}:${email}:${Math.floor(Date.now() / LOGIN_WINDOW_MS)}`;
}

/**
 * True when this ip+email pair still has attempts left in the current
 * 15-minute window. Fails open on KV trouble — a broken limiter should
 * never lock every shelter out.
 */
export async function loginAllowed(env: Env, ip: string, email: string): Promise<boolean> {
  try {
    const n = Number((await env.CONFIG.get(loginRlKey(ip, email))) ?? "0");
    return n < LOGIN_ATTEMPT_LIMIT;
  } catch {
    return true;
  }
}

/** Count a FAILED attempt (successful logins never consume the budget). */
export async function recordFailedLogin(env: Env, ip: string, email: string): Promise<void> {
  try {
    const key = loginRlKey(ip, email);
    const n = Number((await env.CONFIG.get(key)) ?? "0");
    await env.CONFIG.put(key, String(n + 1), { expirationTtl: 1800 });
  } catch {
    // best effort
  }
}
