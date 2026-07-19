/** Shared loader/action logic for public shelter sites. */

import { parseSectionsJson, type Section } from "../../workers/lib/site-sections";
import type { LiveAnimal } from "../components/site-sections";
import { newId } from "../../workers/lib/ids";

export interface SiteOrg {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  nav_json: string | null;
  brand_json: string | null;
}

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  layout: string;
  hero_image_url: string | null;
  hero_eyebrow: string | null;
  subtitle: string | null;
  sections: string;
  body_md: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  publish_at: string | null;
}

export interface NavLinkItem {
  label: string;
  href: string;
}

export const DEFAULT_ACCENT = "#4caf7d";

export function parseNav(org: SiteOrg): NavLinkItem[] {
  try {
    const nav = JSON.parse(org.nav_json ?? "[]");
    if (Array.isArray(nav)) {
      return nav
        .filter((l) => l && typeof l.label === "string" && typeof l.href === "string")
        .slice(0, 12);
    }
  } catch {
    // fall through
  }
  return [
    { label: "Home", href: `/s/${org.slug}` },
    { label: "Adopt", href: `/adopt/${org.slug}` },
  ];
}

export function parseBrand(org: SiteOrg): { accent: string; tagline: string } {
  try {
    const b = JSON.parse(org.brand_json ?? "{}");
    return {
      accent: typeof b.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(b.accent) ? b.accent : DEFAULT_ACCENT,
      tagline: typeof b.tagline === "string" ? b.tagline : "",
    };
  } catch {
    return { accent: DEFAULT_ACCENT, tagline: "" };
  }
}

export async function loadSitePage(
  env: Env,
  orgSlug: string,
  pageSlug: string,
  previewToken?: string | null,
) {
  const org = await env.DB.prepare(
    `SELECT id, name, slug, email, phone, address, website, nav_json, brand_json FROM orgs WHERE slug = ?`,
  )
    .bind(orgSlug)
    .first<SiteOrg>();
  if (!org) throw new Response("Not found", { status: 404 });

  const page = await env.DB.prepare(`SELECT * FROM pages WHERE org_id = ? AND slug = ?`)
    .bind(org.id, pageSlug)
    .first<SitePage>();
  if (!page) throw new Response("Not found", { status: 404 });

  const now = new Date().toISOString();
  const isLive =
    page.status === "published" && (!page.publish_at || page.publish_at <= now);

  let isPreview = false;
  if (!isLive) {
    if (previewToken) {
      const marker = await env.CONFIG.get(`preview:${previewToken}`);
      isPreview = marker === page.id;
    }
    if (!isPreview) throw new Response("Not found", { status: 404 });
  }

  const sections = parseSectionsJson(page.sections);
  const liveAnimals = await resolveLiveSections(env, org.id, sections);

  return { org, page, sections, liveAnimals, isPreview, nav: parseNav(org), brand: parseBrand(org) };
}

export async function resolveLiveSections(
  env: Env,
  orgId: string,
  sections: Section[],
): Promise<Record<number, LiveAnimal[]>> {
  const out: Record<number, LiveAnimal[]> = {};
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (sec.type !== "adoptable_grid") continue;
    const species = typeof sec.species === "string" ? sec.species.trim().toLowerCase() : "";
    let limit = Number(sec.limit);
    if (!isFinite(limit) || limit < 1 || limit > 24) limit = 6;
    let sql = `SELECT a.id, a.name, a.species, a.breed, a.status,
      (SELECT r2_key FROM animal_photos p WHERE p.animal_id = a.id LIMIT 1) photo_key
      FROM animals a WHERE a.org_id = ? AND a.is_public = 1 AND a.status = 'available'`;
    const binds: unknown[] = [orgId];
    if (species) {
      sql += ` AND a.species = ?`;
      binds.push(species);
    }
    sql += ` ORDER BY a.created_at DESC LIMIT ${limit}`;
    const rows = await env.DB.prepare(sql).bind(...binds).all<LiveAnimal>();
    out[i] = rows.results;
  }
  return out;
}

/** Newsletter signups become contacts with the `newsletter` role. */
export async function handleNewsletterSignup(env: Env, orgSlug: string, email: string) {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return { ok: false };
  const org = await env.DB.prepare(`SELECT id FROM orgs WHERE slug = ?`).bind(orgSlug).first<{ id: string }>();
  if (!org) return { ok: false };
  const existing = await env.DB.prepare(`SELECT id, roles FROM contacts WHERE org_id = ? AND email = ?`)
    .bind(org.id, clean)
    .first<{ id: string; roles: string | null }>();
  if (existing) {
    const roles = new Set((existing.roles ?? "").split(",").filter(Boolean));
    roles.add("newsletter");
    await env.DB.prepare(`UPDATE contacts SET roles = ? WHERE id = ?`).bind([...roles].join(","), existing.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO contacts (id, org_id, name, email, roles) VALUES (?, ?, ?, ?, 'newsletter')`,
    )
      .bind(newId("ct"), org.id, clean.split("@")[0], clean)
      .run();
  }
  return { ok: true };
}
