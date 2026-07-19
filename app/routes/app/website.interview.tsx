import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/website.interview";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { generateStarterSite, getAnthropic, logAiWrite } from "../../../workers/lib/ai";

export function meta(_: Route.MetaArgs) {
  return [{ title: "AI site designer — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  return { orgName: user.org_name, hasAiKey: Boolean(getAnthropic(env)) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const answers = {
    shelter_name: String(f.get("shelter_name") ?? user.org_name).trim() || user.org_name,
    town: String(f.get("town") ?? "").trim(),
    animals: String(f.get("animals") ?? "").trim(),
    story: String(f.get("story") ?? "").trim(),
    tone: String(f.get("tone") ?? "warm and joyful").trim(),
    org_slug: user.slug,
  };
  if (!answers.town || !answers.animals || !answers.story) {
    return { error: "Tell us a little more — town, animals, and your story all help the design." };
  }

  const { site, error } = await generateStarterSite(env, answers);
  if (error || !site) return { error: error ?? "Something went sideways — try again." };

  // create everything as DRAFTS; never touch pages that already exist
  const skipped: string[] = [];
  let created = 0;
  for (const page of site.pages) {
    const exists = await env.DB.prepare(`SELECT id FROM pages WHERE org_id = ? AND slug = ?`)
      .bind(user.org_id, page.slug)
      .first();
    if (exists) {
      skipped.push(page.slug);
      continue;
    }
    await env.DB.prepare(
      `INSERT INTO pages (id, org_id, slug, title, subtitle, sections, meta_title, meta_description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    )
      .bind(
        newId("pg"), user.org_id, page.slug, page.title, page.subtitle ?? null,
        JSON.stringify(page.sections), page.meta_title, page.meta_description,
      )
      .run();
    created++;
  }
  if (site.nav.length) {
    await env.DB.prepare(`UPDATE orgs SET nav_json = COALESCE(nav_json, ?) WHERE id = ?`)
      .bind(JSON.stringify(site.nav), user.org_id)
      .run();
  }
  if (site.tagline) {
    const org = await env.DB.prepare(`SELECT brand_json FROM orgs WHERE id = ?`).bind(user.org_id).first<{ brand_json: string | null }>();
    let brand: Record<string, unknown> = {};
    try { brand = JSON.parse(org?.brand_json ?? "{}"); } catch { /* fresh */ }
    if (!brand.tagline) {
      brand.tagline = site.tagline;
      await env.DB.prepare(`UPDATE orgs SET brand_json = ? WHERE id = ?`).bind(JSON.stringify(brand), user.org_id).run();
    }
  }
  await logAiWrite(env, user.org_id, user.user_id, "site_starter", JSON.stringify({ created, skipped, answers: { town: answers.town, tone: answers.tone } }));

  const note =
    created > 0
      ? `Your site is drafted — ${created} page${created === 1 ? "" : "s"} ready for review.${skipped.length ? ` (Left your existing ${skipped.join(", ")} untouched.)` : ""} Nothing is published until you say so.`
      : `Every page already existed, so nothing was changed. Delete a page first if you want the AI to redraft it.`;
  return redirect(`/app/website?ai=${encodeURIComponent(note)}`);
}

const inputCls =
  "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function Interview({ loaderData, actionData }: Route.ComponentProps) {
  const { orgName, hasAiKey } = loaderData;
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  return (
    <div className="max-w-2xl">
      <Link to="/app/website" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Website</Link>
      <h1 className="mt-2 text-2xl font-display font-semibold">✨ AI site designer</h1>
      <p className="mt-2 text-charcoal-soft">
        Answer five plain questions and we'll draft your whole website — homepage, About, Adopt,
        Donate, Volunteer, and FAQ — in your voice. Everything arrives as <strong>drafts</strong>:
        you review, adjust, and publish when it feels right.
      </p>

      {!hasAiKey && (
        <p className="mt-4 rounded-2xl bg-sky/15 text-sky-deep px-4 py-3 text-sm font-semibold">
          Needs an Anthropic API key first — set the <code>ANTHROPIC_API_KEY</code> secret on the
          Worker, then come back. (The rest of the website tools work without it.)
        </p>
      )}

      {actionData?.error && (
        <p className="mt-4 rounded-2xl bg-terracotta/15 text-terracotta-deep px-4 py-3 font-semibold" role="alert">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="mt-6 rounded-blob bg-white shadow-soft p-6 space-y-4">
        <label className="block">
          <span className="font-semibold text-sm">Your shelter's name</span>
          <input name="shelter_name" defaultValue={orgName} className={inputCls} />
        </label>
        <label className="block">
          <span className="font-semibold text-sm">Town or area you serve *</span>
          <input name="town" required placeholder="Assisi Springs, and the whole valley" className={inputCls} />
        </label>
        <label className="block">
          <span className="font-semibold text-sm">What animals do you take in? *</span>
          <input name="animals" required placeholder="Mostly dogs and cats, the occasional rabbit" className={inputCls} />
        </label>
        <label className="block">
          <span className="font-semibold text-sm">Tell us your story — how you started, what you believe *</span>
          <textarea name="story" required rows={5} placeholder="We started in a spare bedroom with three foster kittens…" className={inputCls} />
        </label>
        <label className="block">
          <span className="font-semibold text-sm">Tone</span>
          <select name="tone" className={inputCls}>
            <option value="warm and joyful">Warm and joyful</option>
            <option value="calm and reassuring">Calm and reassuring</option>
            <option value="playful and energetic">Playful and energetic</option>
            <option value="simple and matter-of-fact">Simple and matter-of-fact</option>
          </select>
        </label>
        <button
          disabled={busy || !hasAiKey}
          className="w-full rounded-full bg-sunflower px-6 py-3.5 font-display font-semibold text-lg shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
        >
          {busy ? "Drafting your site — this takes a minute…" : "Draft my whole site"}
        </button>
        <p className="text-xs text-center text-charcoal-soft">
          AI drafts are never published automatically, and this never overwrites pages you already have.
        </p>
      </Form>
    </div>
  );
}
