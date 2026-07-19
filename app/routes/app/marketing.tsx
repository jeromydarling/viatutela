import { aiAvailable } from "../../../workers/lib/ai-shelter";
import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/marketing";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { getAnthropic, logAiWrite } from "../../../workers/lib/ai";
import { parseBrandJson } from "../../../workers/lib/brand";
import { contentIdeas, OBJECTIVES, type ContentIdea } from "../../../workers/lib/marketing";
import { daysBetween } from "../../../workers/lib/ai-shelter";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Marketing Studio — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const campaigns = await env.DB.prepare(
    `SELECT mc.*, a.name animal_name,
       (SELECT COUNT(*) FROM marketing_assets ma WHERE ma.campaign_id = mc.id) assets,
       (SELECT COUNT(*) FROM marketing_assets ma WHERE ma.campaign_id = mc.id AND ma.posted_at IS NOT NULL) posted
     FROM marketing_campaigns mc LEFT JOIN animals a ON a.id = mc.animal_id
     WHERE mc.org_id = ? ORDER BY mc.created_at DESC LIMIT 100`,
  )
    .bind(user.org_id)
    .all<Record<string, unknown>>();
  const animals = await env.DB.prepare(
    `SELECT id, name FROM animals WHERE org_id = ? AND status IN ('available','in foster','pending') ORDER BY name LIMIT 200`,
  )
    .bind(user.org_id)
    .all<{ id: string; name: string }>();
  return { campaigns: campaigns.results, animals: animals.results, aiReady: aiAvailable(env) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const str = (k: string) => String(f.get(k) ?? "").trim();

  if (intent === "create") {
    const name = str("name");
    if (!name) return { error: "Give the campaign a name." };
    const objective = OBJECTIVES.some(([k]) => k === str("objective")) ? str("objective") : "evergreen";
    const animalId = str("animal_id") || null;
    const id = newId("mc");
    await env.DB.prepare(
      `INSERT INTO marketing_campaigns (id, org_id, name, objective, animal_id, key_message) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.org_id, name.slice(0, 120), objective, animalId, str("key_message").slice(0, 300) || null)
      .run();
    return redirect(`/app/marketing/${id}`);
  }

  if (intent === "delete") {
    const id = str("campaign_id");
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM marketing_assets WHERE campaign_id = ? AND org_id = ?`).bind(id, user.org_id),
      env.DB.prepare(`DELETE FROM marketing_campaigns WHERE id = ? AND org_id = ?`).bind(id, user.org_id),
    ]);
    return { ok: "Campaign removed." };
  }

  if (intent === "ideas") {
    const today = new Date();
    const [longest, recent, org] = await Promise.all([
      env.DB.prepare(
        `SELECT id, name, intake_date, description FROM animals
         WHERE org_id = ? AND status IN ('available','in foster') AND intake_date IS NOT NULL
         ORDER BY intake_date LIMIT 8`,
      ).bind(user.org_id).all<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT a.name animal, ad.date FROM adoptions ad JOIN animals a ON a.id = ad.animal_id
         WHERE ad.org_id = ? ORDER BY ad.date DESC LIMIT 5`,
      ).bind(user.org_id).all<{ animal: string; date: string | null }>(),
      env.DB.prepare(`SELECT name, brand_json FROM orgs WHERE id = ?`).bind(user.org_id).first<{ name: string; brand_json: string | null }>(),
    ]);
    const res = await contentIdeas(env, {
      orgId: user.org_id,
      orgName: org?.name ?? "the rescue",
      voice: parseBrandJson(org?.brand_json ?? null).voice,
      month: today.toLocaleString("en-US", { month: "long" }),
      longestWaiting: longest.results.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        days: daysBetween(r.intake_date as string | null, today.toISOString().slice(0, 10)),
        description: r.description ? String(r.description).slice(0, 200) : null,
      })),
      recentAdoptions: recent.results,
      upcomingReminders: 0,
    });
    if (res.error || !res.ideas) return { error: res.error ?? "No ideas came back." };
    await logAiWrite(env, user.org_id, user.user_id, "content_ideas", `${res.ideas.length} ideas`);
    return { ideas: res.ideas };
  }

  if (intent === "adopt-idea") {
    const id = newId("mc");
    await env.DB.prepare(
      `INSERT INTO marketing_campaigns (id, org_id, name, objective, animal_id, key_message) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.org_id,
        str("name").slice(0, 120) || "New campaign",
        OBJECTIVES.some(([k]) => k === str("objective")) ? str("objective") : "evergreen",
        str("animal_id") || null,
        str("key_message").slice(0, 300) || null,
      )
      .run();
    return redirect(`/app/marketing/${id}`);
  }

  return null;
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

const OBJECTIVE_TONE: Record<string, string> = {
  adoption_push: "bg-meadow/20 text-meadow-deep",
  success_story: "bg-sunflower-soft",
  fundraiser: "bg-terracotta/20 text-terracotta-deep",
  press: "bg-sky/20 text-sky-deep",
};

export default function Marketing({ loaderData, actionData }: Route.ComponentProps) {
  const { campaigns, animals, aiReady } = loaderData;
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const a = actionData as { ok?: string; error?: string; ideas?: ContentIdea[] } | undefined;
  const animalName = new Map(animals.map((x) => [x.id, x.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Marketing Studio</h1>
          <p className="text-sm text-charcoal-soft">
            Campaigns become ready-to-post drafts in your voice. Nothing ever posts itself — you stay in charge.
          </p>
        </div>
        <Link to="/app/marketing/calendar" className="rounded-full border-2 border-meadow px-4 py-2 text-sm font-display font-semibold text-meadow-deep hover:bg-meadow hover:text-white transition-colors">
          Content calendar →
        </Link>
      </div>

      {(a?.ok || a?.error) && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${a.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {a.error ?? a.ok}
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">New campaign</h2>
          <Form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="create" />
            <input name="name" required placeholder="Campaign name" className={`${inputCls} w-full`} />
            <select name="objective" className={`${inputCls} w-full`}>
              {OBJECTIVES.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select name="animal_id" className={`${inputCls} w-full`}>
              <option value="">No featured friend</option>
              {animals.map((an) => (
                <option key={an.id} value={an.id}>{an.name}</option>
              ))}
            </select>
            <textarea name="key_message" rows={2} placeholder="Key message (optional)" className={`${inputCls} w-full`} />
            <button disabled={busy} className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
              Create campaign
            </button>
          </Form>
        </section>

        <section className="rounded-blob bg-white shadow-soft p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-lg">✨ Content ideas from your data</h2>
            {aiReady && (
              <Form method="post">
                <input type="hidden" name="intent" value="ideas" />
                <button disabled={busy} className="rounded-full bg-sky text-white px-4 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
                  {busy ? "Thinking…" : "Suggest ideas"}
                </button>
              </Form>
            )}
          </div>
          {!aiReady ? (
            <p className="mt-3 text-sm text-charcoal-soft">Needs the ANTHROPIC_API_KEY secret — then one tap turns your longest-waiting friends and freshest adoptions into campaign starters.</p>
          ) : a?.ideas?.length ? (
            <ul className="mt-3 space-y-2">
              {a.ideas.map((idea, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream p-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-semibold">{idea.name}</span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${OBJECTIVE_TONE[idea.objective] ?? "bg-charcoal/10"}`}>
                      {idea.objective.replace("_", " ")}
                    </span>
                    {idea.animal_id && <span className="ml-2 text-xs text-charcoal-soft">🐾 {animalName.get(idea.animal_id) ?? ""}</span>}
                    <p className="text-xs text-charcoal-soft mt-0.5">{idea.key_message}</p>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="intent" value="adopt-idea" />
                    <input type="hidden" name="name" value={idea.name} />
                    <input type="hidden" name="objective" value={idea.objective} />
                    <input type="hidden" name="animal_id" value={idea.animal_id ?? ""} />
                    <input type="hidden" name="key_message" value={idea.key_message} />
                    <button className="rounded-full bg-sunflower px-4 py-1.5 text-xs font-semibold shadow-soft">Start it</button>
                  </Form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-charcoal-soft">One tap looks at who's waited longest, recent happy endings, and the season — and hands you campaign starters.</p>
          )}
        </section>
      </div>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal-soft">No campaigns yet — create one above, or let the ideas button hand you a head start.</p>
        ) : (
          <ul className="mt-3 divide-y divide-cream">
            {campaigns.map((c) => (
              <li key={String(c.id)} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/app/marketing/${c.id}`} className="font-display font-semibold hover:underline">
                    {String(c.name)}
                  </Link>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${OBJECTIVE_TONE[String(c.objective)] ?? "bg-charcoal/10"}`}>
                    {String(c.objective).replace("_", " ")}
                  </span>
                  {Boolean(c.animal_name) && <span className="ml-2 text-xs text-charcoal-soft">🐾 {String(c.animal_name)}</span>}
                  {String(c.source) !== "manual" && (
                    <span className="ml-2 rounded-full bg-sky/15 text-sky-deep px-2 py-0.5 text-xs font-semibold">auto-drafted</span>
                  )}
                  <span className="ml-2 text-xs text-charcoal-soft">
                    {Number(c.assets)} draft{Number(c.assets) === 1 ? "" : "s"}
                    {Number(c.posted) > 0 && ` · ${Number(c.posted)} posted`}
                  </span>
                </div>
                <Form method="post" onSubmit={(e) => { if (!confirm("Remove this campaign and its drafts?")) e.preventDefault(); }}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="campaign_id" value={String(c.id)} />
                  <button className="text-xs font-semibold text-terracotta-deep hover:underline">remove</button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
