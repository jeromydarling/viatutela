/**
 * Host-based tenant resolution for custom shelter domains.
 *
 * Resolution order per request: platform host (skip) → org by custom_domain
 * (bare host match, so www.X and X both resolve) → pending KV marker
 * (self-activation: the request arriving over HTTPS is the proof the
 * certificate is live) → null (unknown host).
 *
 * On a tenant host, only the public site surface is served — never /app,
 * /login, or private APIs — so sessions stay strictly per-tenant.
 */

import { bareHost, isPlatformHost, takePendingDomain } from "./domains";

export interface Tenant {
  orgId: string;
  slug: string;
  name: string;
}

export async function resolveTenant(env: Env, host: string): Promise<Tenant | null> {
  if (isPlatformHost(host, env)) return null;
  const bare = bareHost(host);

  const org = await env.DB.prepare(
    `SELECT id, slug, name FROM orgs WHERE custom_domain = ?`,
  )
    .bind(bare)
    .first<{ id: string; slug: string; name: string }>();
  if (org) return { orgId: org.id, slug: org.slug, name: org.name };

  // self-activation: first HTTPS visit flips the registry
  const pendingOrgId = await takePendingDomain(env, bare);
  if (pendingOrgId) {
    await env.DB.prepare(
      `UPDATE orgs SET custom_domain = ?, domain_status = 'active' WHERE id = ? AND custom_domain IS NULL`,
    )
      .bind(bare, pendingOrgId)
      .run();
    const activated = await env.DB.prepare(
      `SELECT id, slug, name FROM orgs WHERE id = ? AND custom_domain = ?`,
    )
      .bind(pendingOrgId, bare)
      .first<{ id: string; slug: string; name: string }>();
    if (activated) return { orgId: activated.id, slug: activated.slug, name: activated.name };
  }
  return null;
}

/** Path prefixes allowed to pass through unrewritten on a tenant host. */
const TENANT_PASSTHROUGH = ["/assets/", "/art/", "/api/media/", "/api/feeds/", "/adopt/", "/a/", "/favicon"];

export type TenantRoute =
  | { kind: "rewrite"; path: string }
  | { kind: "passthrough" }
  | { kind: "sitemap" }
  | { kind: "robots" }
  | { kind: "llms" }
  | { kind: "blocked" };

/** Decide how a request path on a tenant host is served. */
export function routeTenantPath(pathname: string, slug: string): TenantRoute {
  if (pathname === "/sitemap.xml") return { kind: "sitemap" };
  if (pathname === "/robots.txt") return { kind: "robots" };
  if (pathname === "/llms.txt") return { kind: "llms" };
  if (TENANT_PASSTHROUGH.some((p) => pathname.startsWith(p))) return { kind: "passthrough" };
  // public newsletter/application posts go through the site page action
  if (pathname === "/" ) return { kind: "rewrite", path: `/s/${slug}` };
  if (pathname === "/donate" || pathname === "/donate/") {
    return { kind: "rewrite", path: `/donate/${slug}` };
  }
  // staff/platform surfaces are never served on shelter domains
  const RESERVED = new Set(["app", "login", "logout", "import", "s", "api"]);
  if (/^\/[a-z0-9-]+\/?$/.test(pathname)) {
    const seg = pathname.replace(/\//g, "");
    if (RESERVED.has(seg)) return { kind: "blocked" };
    return { kind: "rewrite", path: `/s/${slug}/${seg}` };
  }
  // anything else (/app, /login, /import, /api/*, nested paths) is not served
  // on tenant domains — keeps staff sessions and private APIs off shelter hosts
  return { kind: "blocked" };
}

export async function tenantSitemap(env: Env, tenant: Tenant, origin: string): Promise<Response> {
  const pages = await env.DB.prepare(
    `SELECT slug, updated_at FROM pages
     WHERE org_id = ? AND status = 'published' AND (publish_at IS NULL OR publish_at <= datetime('now'))`,
  )
    .bind(tenant.orgId)
    .all<{ slug: string; updated_at: string }>();
  const animals = await env.DB.prepare(
    `SELECT id FROM animals WHERE org_id = ? AND is_public = 1 AND status = 'available' LIMIT 500`,
  )
    .bind(tenant.orgId)
    .all<{ id: string }>();

  const urls: string[] = [];
  for (const p of pages.results) {
    const path = p.slug === "home" ? "/" : `/${p.slug}`;
    urls.push(
      `<url><loc>${origin}${path}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod></url>`,
    );
  }
  urls.push(`<url><loc>${origin}/adopt/${tenant.slug}</loc></url>`);
  for (const a of animals.results) {
    urls.push(`<url><loc>${origin}/adopt/${tenant.slug}/${a.id}</loc></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
  });
}

export function tenantRobots(origin: string): Response {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /a/\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
  });
}

/** A plain-language markdown summary for AI assistants (llms.txt convention). */
export async function tenantLlms(env: Env, tenant: Tenant, origin: string): Promise<Response> {
  const org = await env.DB.prepare(
    `SELECT name, about, email, phone, address FROM orgs WHERE id = ?`,
  )
    .bind(tenant.orgId)
    .first<{ name: string; about: string | null; email: string | null; phone: string | null; address: string | null }>();
  const animals = await env.DB.prepare(
    `SELECT name, species, breed FROM animals WHERE org_id = ? AND is_public = 1 AND status = 'available'
     ORDER BY created_at DESC LIMIT 25`,
  )
    .bind(tenant.orgId)
    .all<{ name: string; species: string | null; breed: string | null }>();
  const name = org?.name ?? tenant.slug;

  const lines = [
    `# ${name}`,
    "",
    `> ${org?.about?.trim() || `${name} is an animal shelter helping companion animals find loving homes.`}`,
    "",
    "## Adopt",
    "",
    `- [Adoptable animals](${origin}/adopt/${tenant.slug}): every friend currently looking for a home`,
    `- [Donate](${origin}/donate/${tenant.slug}): support the shelter's work`,
  ];
  if (animals.results.length) {
    lines.push("", "## Friends currently available", "");
    for (const a of animals.results) {
      const desc = [a.breed ?? a.species].filter(Boolean).join("");
      lines.push(`- ${a.name}${desc ? ` — ${desc}` : ""}`);
    }
  }
  const contact = [org?.email, org?.phone, org?.address].filter(Boolean).join(" · ");
  if (contact) lines.push("", "## Contact", "", contact);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
