import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/website.seo";
import { requireUser } from "../../lib/auth.server";
import { parseSeo } from "../../lib/site.server";
import { TRACKER_FIELDS, validateTracking } from "../../../workers/lib/tracking";

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

  const [pagesNoMeta, publishedPages, animalsNoPhoto, animalsNoBio] = await Promise.all([
    env.DB.prepare(
      `SELECT id, slug, title FROM pages WHERE org_id = ? AND status = 'published'
       AND (meta_description IS NULL OR meta_description = '') LIMIT 20`,
    ).bind(user.org_id).all<{ id: string; slug: string; title: string }>(),
    env.DB.prepare(
      `SELECT COUNT(*) n FROM pages WHERE org_id = ? AND status = 'published'`,
    ).bind(user.org_id).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT id, name FROM animals a WHERE org_id = ? AND is_public = 1 AND status = 'available'
       AND NOT EXISTS (SELECT 1 FROM animal_photos p WHERE p.animal_id = a.id) LIMIT 20`,
    ).bind(user.org_id).all<{ id: string; name: string }>(),
    env.DB.prepare(
      `SELECT id, name FROM animals WHERE org_id = ? AND is_public = 1 AND status = 'available'
       AND (description IS NULL OR length(description) < 40) LIMIT 20`,
    ).bind(user.org_id).all<{ id: string; name: string }>(),
  ]);

  return {
    slug: org?.slug ?? "",
    seo: parseSeo(org?.seo_json ?? null),
    domain: org?.custom_domain ?? null,
    domainStatus: org?.domain_status ?? null,
    pagesNoMeta: pagesNoMeta.results,
    publishedPages: publishedPages?.n ?? 0,
    animalsNoPhoto: animalsNoPhoto.results,
    animalsNoBio: animalsNoBio.results,
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

function Check({ pass, label, children }: { pass: boolean; label: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3 border-t border-cream first:border-t-0">
      <span className={`mt-0.5 w-6 h-6 flex-none rounded-full flex items-center justify-center text-sm font-bold ${pass ? "bg-meadow/20 text-meadow-deep" : "bg-terracotta/20 text-terracotta-deep"}`}>
        {pass ? "✓" : "!"}
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        {!pass && children && <div className="text-sm text-charcoal-soft mt-0.5">{children}</div>}
      </div>
    </li>
  );
}

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
          <h2 className="font-display font-semibold text-lg">Search Checkup</h2>
          <ul className="mt-2">
            <Check pass={d.seo.visible} label="Site is visible to search engines">
              Turn visibility on above when you're ready to launch.
            </Check>
            <Check pass={Boolean(d.seo.google_verify)} label="Google Search Console verified">
              Paste the meta-tag value above, then submit your sitemap. It's free and takes five minutes.
            </Check>
            <Check pass={d.publishedPages > 0} label={`Website has published pages (${d.publishedPages})`}>
              <Link to="/app/website" className="font-semibold text-meadow-deep hover:underline">Publish your site →</Link>
            </Check>
            <Check pass={d.pagesNoMeta.length === 0} label="Published pages all have meta descriptions">
              {d.pagesNoMeta.map((p) => (
                <Link key={p.id} to={`/app/website/pages/${p.id}`} className="mr-2 font-semibold text-meadow-deep hover:underline">
                  {p.title} →
                </Link>
              ))}
              <span className="block text-xs mt-1">Tip: the ✨ AI button on each page drafts these for you.</span>
            </Check>
            <Check pass={d.animalsNoPhoto.length === 0} label="Every adoptable friend has a photo">
              {d.animalsNoPhoto.map((an) => (
                <Link key={an.id} to={`/app/animals/${an.id}`} className="mr-2 font-semibold text-meadow-deep hover:underline">
                  {an.name} →
                </Link>
              ))}
              <span className="block text-xs mt-1">Animals with photos get dramatically more clicks — and adopted faster.</span>
            </Check>
            <Check pass={d.animalsNoBio.length === 0} label="Every adoptable friend has a real bio">
              {d.animalsNoBio.map((an) => (
                <Link key={an.id} to={`/app/animals/${an.id}`} className="mr-2 font-semibold text-meadow-deep hover:underline">
                  {an.name} →
                </Link>
              ))}
              <span className="block text-xs mt-1">The ✨ AI bio writer on each profile turns two facts into a great one.</span>
            </Check>
            <Check pass={Boolean(d.domain && d.domainStatus === "active")} label="Custom domain connected">
              <Link to="/app/website/domain" className="font-semibold text-meadow-deep hover:underline">
                {d.domain ? `${d.domain} is ${d.domainStatus ?? "pending"} →` : "Connect your own domain →"}
              </Link>
            </Check>
          </ul>
          <p className="mt-3 text-xs text-charcoal-soft">
            Local SEO in one line: correct shelter info + fresh content (blog drafts in Marketing) + local links (press
            releases in Marketing). The studios feed all three.
          </p>
        </section>
      </div>
    </div>
  );
}
