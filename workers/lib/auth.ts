export const AUTH_COOKIE = "vt_session";

export async function getAuthedUser(env: Env, request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${AUTH_COOKIE}=([a-f0-9]{48})`));
  if (!match) return null;
  const row = await env.DB.prepare(
    `SELECT u.id user_id, u.email, u.name user_name, o.id org_id, o.name org_name, o.slug, o.plan
     FROM sessions s JOIN users u ON u.id = s.user_id JOIN orgs o ON o.id = u.org_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
  )
    .bind(match[1])
    .first<Record<string, unknown>>();
  return row;
}
