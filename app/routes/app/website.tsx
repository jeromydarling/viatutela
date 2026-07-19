import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/website";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { parseBrand, DEFAULT_ACCENT } from "../../lib/site.server";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Website — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const aiNote = new URL(request.url).searchParams.get("ai");
  const [pages, org] = await Promise.all([
    env.DB.prepare(
      `SELECT id, slug, title, status, publish_at, updated_at FROM pages WHERE org_id = ? ORDER BY (slug = 'home') DESC, title`,
    ).bind(user.org_id).all<Record<string, string | null>>(),
    env.DB.prepare(`SELECT * FROM orgs WHERE id = ?`).bind(user.org_id).first<Record<string, string | null>>(),
  ]);
  let nav: { label: string; href: string }[] = [];
  try {
    const parsed = JSON.parse(org?.nav_json ?? "[]");
    if (Array.isArray(parsed)) nav = parsed;
  } catch { /* default below */ }
  return {
    pages: pages.results,
    nav,
    brand: parseBrand(org as never),
    slug: user.slug,
    hasAiKey: Boolean((env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY),
    aiNote,
  };
}

const STARTERS: { slug: string; title: string; sections: (orgName: string, orgSlug: string) => unknown[] }[] = [
  {
    slug: "home",
    title: "Home",
    sections: (orgName, orgSlug) => [
      { type: "home_hero", eyebrow: "Welcome to", heading: orgName, sub: "Every animal deserves a way home — come meet yours.", cta_label: "Meet the animals", cta_href: `/adopt/${orgSlug}` },
      { type: "adoptable_grid", heading: "Looking for a home", limit: 6 },
      { type: "cta_band", heading: "Lend a paw", text: "Adopt, foster, volunteer, or give — every bit of kindness counts.", primary_label: "Adopt", primary_href: `/adopt/${orgSlug}`, secondary_label: "Donate", secondary_href: `/s/${orgSlug}/donate` },
      { type: "newsletter_signup", heading: "Stay close to the pack", text: "Occasional good news, adoption days, and friends who found home." },
    ],
  },
  {
    slug: "about",
    title: "About us",
    sections: (orgName) => [
      { type: "prose", md: `## Our story\n\nWrite the story of ${orgName} here — how you began, who you serve, and what you believe about animals and the people who love them.` },
      { type: "quote", text: "Saving one animal won't change the world, but for that one animal the world changes forever.", attribution: "" },
    ],
  },
  {
    slug: "adopt",
    title: "Adopt",
    sections: (_orgName, orgSlug) => [
      { type: "hero", heading: "Adopt a friend", sub: "Applying is free and starts a conversation — it never commits you." },
      { type: "adoptable_grid", heading: "Waiting for you", limit: 12 },
      { type: "faq", heading: "How adopting works", items: [
        { q: "What does adoption cost?", a: "Fees vary by animal and cover vaccines, spay/neuter, and microchip." },
        { q: "How long does it take?", a: "Usually a few days: application, a quick conversation, then homecoming." },
      ] },
    ],
  },
  {
    slug: "donate",
    title: "Donate",
    sections: (orgName) => [
      { type: "hero", heading: "Give a little sunshine", sub: `Every cent goes to the animals in ${orgName}'s care.` },
      { type: "prose", md: "Tell supporters how gifts are used — food, vet care, warm beds — and how to give (check, cash, online)." },
      { type: "cta_band", heading: "Ready to help?", text: "Reach out and we'll make it easy.", primary_label: "Contact us", primary_href: "mailto:" },
    ],
  },
  {
    slug: "volunteer",
    title: "Volunteer & foster",
    sections: () => [
      { type: "hero", heading: "Join the flock", sub: "Walk dogs, cuddle cats, foster a friend between homes." },
      { type: "prose", md: "Describe your volunteer roles and foster program here — time commitment, training, and who to contact." },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    sections: () => [
      { type: "faq", heading: "Good questions", items: [
        { q: "Where are you located?", a: "Add your address and visiting hours here." },
        { q: "Can I visit before applying?", a: "Tell people how visits work." },
      ] },
    ],
  },
];

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));

  if (intent === "create-page") {
    const title = String(f.get("title") ?? "").trim();
    if (!title) return { error: "The page needs a title." };
    const slug = (String(f.get("slug") ?? "") || title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return { error: "That slug doesn't work — try letters and dashes." };
    const exists = await env.DB.prepare(`SELECT id FROM pages WHERE org_id = ? AND slug = ?`).bind(user.org_id, slug).first();
    if (exists) return { error: `A page with slug "${slug}" already exists.` };
    const id = newId("pg");
    await env.DB.prepare(
      `INSERT INTO pages (id, org_id, slug, title, sections) VALUES (?, ?, ?, ?, '[]')`,
    ).bind(id, user.org_id, slug, title).run();
    return redirect(`/app/website/pages/${id}`);
  }

  if (intent === "create-starters") {
    for (const st of STARTERS) {
      const exists = await env.DB.prepare(`SELECT id FROM pages WHERE org_id = ? AND slug = ?`).bind(user.org_id, st.slug).first();
      if (exists) continue;
      await env.DB.prepare(
        `INSERT INTO pages (id, org_id, slug, title, sections) VALUES (?, ?, ?, ?, ?)`,
      ).bind(newId("pg"), user.org_id, st.slug, st.title, JSON.stringify(st.sections(user.org_name, user.slug))).run();
    }
    const nav = [
      { label: "Home", href: `/s/${user.slug}` },
      { label: "Adopt", href: `/s/${user.slug}/adopt` },
      { label: "About", href: `/s/${user.slug}/about` },
      { label: "Donate", href: `/s/${user.slug}/donate` },
      { label: "Volunteer", href: `/s/${user.slug}/volunteer` },
      { label: "FAQ", href: `/s/${user.slug}/faq` },
    ];
    await env.DB.prepare(`UPDATE orgs SET nav_json = COALESCE(nav_json, ?) WHERE id = ?`)
      .bind(JSON.stringify(nav), user.org_id).run();
    return { ok: "Starter pages created as drafts — open each one to make it yours, then publish." };
  }

  if (intent === "save-nav") {
    const nav: { label: string; href: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const label = String(f.get(`nav.${i}.label`) ?? "").trim();
      const href = String(f.get(`nav.${i}.href`) ?? "").trim();
      if (label && href) nav.push({ label, href });
    }
    await env.DB.prepare(`UPDATE orgs SET nav_json = ? WHERE id = ?`).bind(JSON.stringify(nav), user.org_id).run();
    return { ok: "Navigation saved." };
  }

  if (intent === "save-brand") {
    const accent = String(f.get("accent") ?? "").trim();
    const tagline = String(f.get("tagline") ?? "").trim();
    const brand = {
      accent: /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_ACCENT,
      tagline,
    };
    await env.DB.prepare(`UPDATE orgs SET brand_json = ? WHERE id = ?`).bind(JSON.stringify(brand), user.org_id).run();
    return { ok: "Brand saved." };
  }

  if (intent === "delete-page") {
    await env.DB.prepare(`DELETE FROM pages WHERE id = ? AND org_id = ?`).bind(String(f.get("page_id")), user.org_id).run();
    return { ok: "Page removed." };
  }

  return null;
}

const inputCls =
  "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

export default function Website({ loaderData, actionData }: Route.ComponentProps) {
  const { pages, nav, brand, slug, hasAiKey, aiNote } = loaderData;
  const navRows = [...nav, { label: "", href: "" }].slice(0, 12);

  return (
    <div className="space-y-8">
      {aiNote && (
        <p className="rounded-2xl bg-meadow/15 text-meadow-deep px-4 py-3 font-semibold">✨ {aiNote}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-semibold">Your website</h1>
        <div className="flex gap-3">
          <a
            href={`/s/${slug}`}
            className="rounded-full border-2 border-meadow px-4 py-2 text-sm font-display font-semibold text-meadow-deep hover:bg-meadow hover:text-white transition-colors"
          >
            View site ↗
          </a>
          <Link
            to="/app/website/interview"
            className="rounded-full bg-sunflower px-4 py-2 text-sm font-display font-semibold shadow-soft"
          >
            ✨ AI site designer
          </Link>
        </div>
      </div>

      {(actionData?.ok || actionData?.error) && (
        <p className={`rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}>
          {actionData.error ?? actionData.ok}
        </p>
      )}

      {!hasAiKey && (
        <p className="rounded-2xl bg-sky/15 text-sky-deep px-4 py-3 text-sm font-semibold">
          The AI site designer needs an Anthropic API key (set the <code>ANTHROPIC_API_KEY</code> secret
          on the Worker). Everything else here works without it.
        </p>
      )}

      <section className="rounded-blob bg-white shadow-soft p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-lg">Pages</h2>
          {pages.length === 0 && (
            <Form method="post">
              <input type="hidden" name="intent" value="create-starters" />
              <button className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-display font-semibold shadow-soft">
                Create starter pages
              </button>
            </Form>
          )}
        </div>
        {pages.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal-soft">
            No pages yet. Create the starter set (Home, About, Adopt, Donate, Volunteer, FAQ) or let
            the ✨ AI site designer draft the whole site from a short interview.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-cream">
            {pages.map((p) => (
              <li key={String(p.id)} className="py-3 flex flex-wrap items-center gap-3">
                <Link to={`/app/website/pages/${p.id}`} className="font-display font-semibold hover:underline">
                  {String(p.title)}
                </Link>
                <span className="text-xs text-charcoal-soft">/{String(p.slug)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  p.status === "published" ? "bg-meadow/20 text-meadow-deep" : "bg-sunflower-soft"
                }`}>
                  {String(p.status)}
                  {p.publish_at && p.status === "published" ? ` · from ${String(p.publish_at).slice(0, 10)}` : ""}
                </span>
                <span className="flex-1" />
                <a href={`/s/${slug}${p.slug === "home" ? "" : `/${p.slug}`}`} className="text-xs font-semibold text-sky-deep hover:underline">
                  view
                </a>
                {p.slug !== "home" && (
                  <Form method="post" onSubmit={(e) => { if (!confirm(`Delete "${p.title}"?`)) e.preventDefault(); }}>
                    <input type="hidden" name="intent" value="delete-page" />
                    <input type="hidden" name="page_id" value={String(p.id)} />
                    <button className="text-xs font-semibold text-terracotta-deep hover:underline">delete</button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
        <Form method="post" className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="intent" value="create-page" />
          <input name="title" required placeholder="New page title" className={`${inputCls} flex-1 min-w-40`} />
          <input name="slug" placeholder="slug (optional)" className={`${inputCls} w-36`} />
          <button className="rounded-full bg-sunflower px-4 py-2 text-sm font-display font-semibold shadow-soft">
            Add page
          </button>
        </Form>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">Navigation</h2>
          <p className="mt-1 text-xs text-charcoal-soft">The menu across the top of your site, in order.</p>
          <Form method="post" className="mt-3 space-y-2">
            <input type="hidden" name="intent" value="save-nav" />
            {navRows.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input name={`nav.${i}.label`} defaultValue={l.label} placeholder="Label" className={`${inputCls} w-32`} />
                <input name={`nav.${i}.href`} defaultValue={l.href} placeholder={`/s/${slug}/about`} className={`${inputCls} flex-1`} />
              </div>
            ))}
            <button className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-semibold">Save navigation</button>
          </Form>
        </section>

        <div className="space-y-6">
          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-lg">Brand</h2>
            <Form method="post" className="mt-3 space-y-3">
              <input type="hidden" name="intent" value="save-brand" />
              <label className="flex items-center gap-3 text-sm font-semibold">
                Accent color
                <input name="accent" type="color" defaultValue={brand.accent} className="h-9 w-16 rounded cursor-pointer border-2 border-cream" />
                <span className="text-xs text-charcoal-soft">buttons, links, and bands on your site</span>
              </label>
              <label className="block text-sm font-semibold">
                Tagline
                <input name="tagline" defaultValue={brand.tagline} placeholder="Every animal deserves a way home." className={`${inputCls} mt-1 w-full`} />
              </label>
              <button className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-semibold">Save brand</button>
            </Form>
          </section>

          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-lg">Media library</h2>
            <p className="mt-1 text-sm text-charcoal-soft">
              Photos for your pages — every image needs a description so screen readers can enjoy it too.
            </p>
            <Link to="/app/website/media" className="inline-block mt-3 rounded-full bg-sunflower px-5 py-2 text-sm font-display font-semibold shadow-soft">
              Open media library
            </Link>
          </section>

          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-lg">Custom domain</h2>
            <p className="mt-1 text-sm text-charcoal-soft">
              Put your site on your own domain (like <em>happypawsrescue.org</em>).
            </p>
            <Link to="/app/website/domain" className="inline-block mt-3 rounded-full border-2 border-meadow px-5 py-2 text-sm font-display font-semibold text-meadow-deep hover:bg-meadow hover:text-white transition-colors">
              Domain settings
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
