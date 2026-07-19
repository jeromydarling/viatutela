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

export function sessionCookie(token: string, maxAge = 30 * 24 * 3600): string {
  return `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
