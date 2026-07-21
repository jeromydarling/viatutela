import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/website.seo";
import { useState } from "react";
import { requireUser } from "../../lib/auth.server";
import { parseSeo } from "../../lib/site.server";
import { TRACKER_FIELDS, validateTracking } from "../../../workers/lib/tracking";
import { AUDIT_GROUPS, runAudit, scoreAudit, sortChecks, type AuditCheck, type CheckStatus } from "../../../workers/lib/seo-audit";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SEO & Search Checkup — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = await env.DB.prepare(
    `SELECT slug, seo_json, custom_domain, domain_status FROM orgs WHERE id = ?`,
  )
    .bind(user.org_id)
    .first<{ slug: string; seo_json: string | null; custom_domain: string | null; domain_status: string | null }>();

  const [pageStats, animalStats, photoAlt] = await Promise.all([
    env.DB.prepare(
      `SELECT
         COUNT(*) published,
         SUM(CASE WHEN slug = 'home' THEN 1 ELSE 0 END) home,
         SUM(CASE WHEN meta_description IS NULL OR meta_description = '' THEN 1 ELSE 0 END) no_meta,
         SUM(CASE WHEN length(COALESCE(meta_title, title)) > 60 THEN 1 ELSE 0 END) long_title,
         SUM(CASE WHEN length(meta_description) > 160 THEN 1 ELSE 0 END) long_meta,
         SUM(CASE WHEN (hero_image_url IS NULL OR hero_image_url = '') THEN 1 ELSE 0 END) no_hero
       FROM pages WHERE org_id = ? AND status = 'published'`,
    ).bind(user.org_id).first<{ published: number; home: number; no_meta: number; long_title: number; long_meta: number; no_hero: number }>(),
    env.DB.prepare(
      `SELECT
         COUNT(*) adoptable,
         SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM animal_photos p WHERE p.animal_id = a.id) THEN 1 ELSE 0 END) no_photo,
         SUM(CASE WHEN description IS NULL OR length(description) < 40 THEN 1 ELSE 0 END) no_bio
       FROM animals a WHERE org_id = ? AND is_public = 1 AND status = 'available'`,
    ).bind(user.org_id).first<{ adoptable: number; no_photo: number; no_bio: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) n FROM animal_photos p
       JOIN animals a ON a.id = p.animal_id
       WHERE a.org_id = ? AND a.is_public = 1 AND p.kind != 'video'
         AND (p.alt_text IS NULL OR p.alt_text = '')`,
    ).bind(user.org_id).first<{ n: number }>(),
  ]);

  const seo = parseSeo(org?.seo_json ?? null);
  const auditInput = {
    visible: seo.visible,
    googleVerify: Boolean(seo.google_verify),
    bingVerify: Boolean(seo.bing_verify),
    defaultOgImage: Boolean(seo.og_image),
    publishedPages: pageStats?.published ?? 0,
    hasHomePage: (pageStats?.home ?? 0) > 0,
    pagesMissingMeta: pageStats?.no_meta ?? 0,
    pagesLongTitle: pageStats?.long_title ?? 0,
    pagesLongMeta: pageStats?.long_meta ?? 0,
    pagesNoSocialImage: pageStats?.no_hero ?? 0,
    adoptableTotal: animalStats?.adoptable ?? 0,
    animalsNoPhoto: animalStats?.no_photo ?? 0,
    animalsNoBio: animalStats?.no_bio ?? 0,
    photosNoAlt: photoAlt?.n ?? 0,
    domainActive: org?.domain_status === "active" && Boolean(org?.custom_domain),
    domainPending: Boolean(org?.custom_domain) && org?.domain_status !== "active",
  };
  const checks = sortChecks(runAudit(auditInput));

  return {
    slug: org?.slug ?? "",
    seo,
    checks,
    score: scoreAudit(checks),
    domain: org?.custom_domain ?? null,
    domainStatus: org?.domain_status ?? null,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  if (String(f.get("intent")) !== "save") return null;
  const { tracking, errors } = validateTracking({
    ga4: String(f.get("ga4") ?? ""),
    gtm: String(f.get("gtm") ?? ""),
    meta_pixel: String(f.get("meta_pixel") ?? ""),
    plausible: String(f.get("plausible") ?? ""),
  });
  const seo = {
    visible: Boolean(f.get("visible")),
    google_verify: String(f.get("google_verify") ?? "").trim().slice(0, 200),
    bing_verify: String(f.get("bing_verify") ?? "").trim().slice(0, 200),
    og_image: String(f.get("og_image") ?? "").trim().slice(0, 500),
    tracking,
  };
  await env.DB.prepare(`UPDATE orgs SET seo_json = ? WHERE id = ?`)
    .bind(JSON.stringify(seo), user.org_id)
    .run();
  if (errors.length) {
    return { ok: "Saved — but some tracker IDs were skipped:", errors };
  }
  return { ok: "SEO settings saved." };
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

const STATUS_STYLE: Record<CheckStatus, { icon: string; badge: string }> = {
  warn: { icon: "⚠", badge: "bg-terracotta/15 text-terracotta-deep" },
  suggest: { icon: "💡", badge: "bg-sky/15 text-sky-deep" },
  pass: { icon: "✓", badge: "bg-meadow/20 text-meadow-deep" },
};

function ReviewRow({ check }: { check: AuditCheck }) {
  const [open, setOpen] = useState(check.status === "warn");
  const s = STATUS_STYLE[check.status];
  return (
    <div className="border-t border-cream first:border-t-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 py-3 text-left"
        aria-expanded={open}
      >
        <span className={`w-7 h-7 flex-none rounded-full flex items-center justify-center text-sm font-bold ${s.badge}`}>
          {s.icon}
        </span>
        <span className={`flex-1 font-semibold text-sm ${check.status === "pass" ? "text-charcoal-soft" : ""}`}>
          {check.title}
        </span>
        <span className="text-charcoal-soft text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="pl-10 pb-3 -mt-1 text-sm text-charcoal-soft">
          {check.detail}
          {check.fix && (
            <div className="mt-2">
              <Link to={check.fix.to} className="font-semibold text-meadow-deep hover:underline">
                {check.fix.label} →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const GRADE_COLOR: Record<string, string> = {
  Excellent: "text-meadow-deep",
  Good: "text-meadow-deep",
  "Needs work": "text-terracotta-deep",
  "Getting started": "text-terracotta-deep",
};

export default function SeoCheckup({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const nav = useNavigation();
  const a = actionData as { ok?: string; errors?: string[] } | undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/website" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Website</Link>
        <h1 className="text-2xl font-display font-semibold">SEO & Search Checkup</h1>
        <p className="text-sm text-charcoal-soft">Getting found on Google isn't a mystery — it's this checklist.</p>
      </div>

      {a?.ok && (
        <div className={`rounded-2xl px-4 py-2.5 font-semibold ${a.errors?.length ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}>
          {a.ok}
          {a.errors?.map((e) => (
            <div key={e} className="text-sm font-normal mt-1">{e}</div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">Settings</h2>
          <Form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="save" />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="visible" defaultChecked={d.seo.visible} />
              Site visible to search engines
              <span className="text-xs font-normal text-charcoal-soft">(uncheck pre-launch — adds noindex everywhere)</span>
            </label>
            <label className="block text-sm font-semibold">
              Google site verification
              <input name="google_verify" defaultValue={d.seo.google_verify} placeholder="content value from Search Console's meta-tag option" className={`${inputCls} w-full mt-1`} />
            </label>
            <label className="block text-sm font-semibold">
              Bing site verification
              <input name="bing_verify" defaultValue={d.seo.bing_verify} placeholder="msvalidate.01 content value" className={`${inputCls} w-full mt-1`} />
            </label>
            <label className="block text-sm font-semibold">
              Default share image URL
              <input name="og_image" defaultValue={d.seo.og_image} placeholder="/api/media/orgs/…  (used when a page has no hero image)" className={`${inputCls} w-full mt-1`} list="media-urls" />
            </label>
            <div className="pt-3 border-t border-cream">
              <h3 className="font-display font-semibold">Analytics &amp; tracking</h3>
              <p className="text-xs text-charcoal-soft mt-0.5">
                Paste just the ID — we add the official snippet to your public site for you. Pasted
                code is never accepted, so nothing unexpected can run on your pages. If you enable a
                tracker, disclosing it in your own privacy policy is your responsibility.
              </p>
              <div className="mt-2 space-y-3">
                {TRACKER_FIELDS.map((t) => (
                  <label key={t.key} className="block text-sm font-semibold">
                    {t.label}
                    <input
                      name={t.key}
                      defaultValue={d.seo.tracking[t.key]}
                      placeholder={t.placeholder}
                      className={`${inputCls} w-full mt-1`}
                    />
                    <span className="block text-xs font-normal text-charcoal-soft mt-0.5">{t.hint}</span>
                  </label>
                ))}
              </div>
            </div>
            <button disabled={nav.state !== "idle"} className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
              Save settings
            </button>
          </Form>
          <p className="mt-4 text-xs text-charcoal-soft">
            Your sitemap lives at <code>/sitemap.xml</code> on your site domain — submit it once in Google Search Console.
            The homepage carries AnimalShelter structured data automatically.
          </p>
        </section>

        <section className="rounded-blob bg-white shadow-soft p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-lg">Search &amp; AI Review</h2>
            <div className="text-right">
              <div className={`text-3xl font-display font-bold leading-none ${GRADE_COLOR[d.score.grade] ?? "text-charcoal"}`}>
                {d.score.percent}%
              </div>
              <div className="text-xs font-semibold text-charcoal-soft">{d.score.grade}</div>
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-cream overflow-hidden">
            <div className="h-full bg-meadow rounded-full transition-all" style={{ width: `${d.score.percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-charcoal-soft">
            A live review of your public website — what search engines and AI assistants see. Fix the
            orange items first; the rest is handled for you.
          </p>

          <div className="mt-4 space-y-5">
            {AUDIT_GROUPS.map((group) => {
              const rows = d.checks.filter((c) => c.group === group);
              if (!rows.length) return null;
              return (
                <div key={group}>
                  <h3 className="text-xs font-display font-semibold uppercase tracking-wide text-charcoal-soft">{group}</h3>
                  <div className="mt-1">
                    {rows.map((c) => (
                      <ReviewRow key={c.id} check={c} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
