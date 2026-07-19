import { aiAvailable } from "../../workers/lib/ai-flags";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/adopt.match";
import { getEnv } from "../lib/auth.server";
import { getAnthropic, logAiWrite } from "../../workers/lib/ai";
import { checkAiRateLimit, compactAnimal, matchAnimals } from "../../workers/lib/ai-shelter";
import { PawDoodle } from "../components/doodles";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `Find your match at ${data?.org?.name ?? "a rescue"} — Tutela` },
    { name: "description", content: "Answer six quick questions and we'll suggest the friends most likely to fit your home." },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(`SELECT id, name, slug FROM orgs WHERE slug = ?`)
    .bind(params.slug)
    .first<{ id: string; name: string; slug: string }>();
  if (!org) throw new Response("Not found", { status: 404 });
  const count = await env.DB.prepare(
    `SELECT COUNT(*) n FROM animals WHERE org_id = ? AND is_public = 1 AND status IN ('available','in foster')`,
  )
    .bind(org.id)
    .first<{ n: number }>();
  return { org, available: count?.n ?? 0, aiReady: aiAvailable(env) };
}

interface MatchView {
  animal_id: string;
  name: string;
  score: number;
  reason: string;
  photo_key: string | null;
  breed: string | null;
  species: string | null;
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(`SELECT id, name, slug FROM orgs WHERE slug = ?`)
    .bind(params.slug)
    .first<{ id: string; name: string; slug: string }>();
  if (!org) throw new Response("Not found", { status: 404 });

  const f = await request.formData();
  // honeypot: bots fill every field
  if (String(f.get("website") ?? "")) return { matches: [] as MatchView[], note: "Thanks!" };

  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  if (
    !(await checkAiRateLimit(env, `match:ip:${ip}`, 5)) ||
    !(await checkAiRateLimit(env, `match:org:${org.id}`, 60))
  ) {
    return { error: "The matchmaker is very popular right now — please try again in a little while, or just browse everyone below." };
  }

  const answers: Record<string, string> = {};
  for (const key of ["looking_for", "home", "kids", "other_pets", "activity", "experience", "extra"]) {
    const v = String(f.get(key) ?? "").trim();
    if (v) answers[key] = v.slice(0, 500);
  }

  const rows = await env.DB.prepare(
    `SELECT * FROM animals WHERE org_id = ? AND is_public = 1 AND status IN ('available','in foster')
     ORDER BY intake_date LIMIT 60`,
  )
    .bind(org.id)
    .all<Record<string, unknown>>();
  if (rows.results.length === 0) {
    return { error: "No friends are looking for homes right now — check back soon." };
  }

  const res = await matchAnimals(env, {
    answers,
    animals: rows.results.map((r) => compactAnimal(r)),
    orgName: org.name,
  });
  if (res.error || !res.result) {
    return { error: res.error ?? "The matchmaker hit a snag — try again in a moment." };
  }
  await logAiWrite(env, org.id, null, "match_quiz", JSON.stringify({ answers: Object.keys(answers), matches: res.result.matches.length }));

  const byId = new Map(rows.results.map((r) => [String(r.id), r]));
  const ids = res.result.matches.map((m) => m.animal_id);
  const photos = ids.length
    ? await env.DB.prepare(
        `SELECT animal_id, MIN(r2_key) r2_key FROM animal_photos WHERE animal_id IN (${ids.map(() => "?").join(",")}) GROUP BY animal_id`,
      )
        .bind(...ids)
        .all<{ animal_id: string; r2_key: string }>()
    : { results: [] as { animal_id: string; r2_key: string }[] };
  const photoBy = new Map(photos.results.map((p) => [p.animal_id, p.r2_key]));

  const matches: MatchView[] = res.result.matches.map((m) => {
    const row = byId.get(m.animal_id);
    return {
      animal_id: m.animal_id,
      name: String(row?.name ?? ""),
      score: m.score,
      reason: m.reason,
      photo_key: photoBy.get(m.animal_id) ?? null,
      breed: row?.breed ? String(row.breed) : null,
      species: row?.species ? String(row.species) : null,
    };
  });
  return { matches, note: res.result.note };
}

const selectCls =
  "w-full rounded-xl border-2 border-cream bg-cream px-3 py-2.5 focus:border-meadow outline-none";

const QUESTIONS: { name: string; label: string; options: string[] }[] = [
  { name: "looking_for", label: "Who are you hoping to meet?", options: ["A dog", "A cat", "Either — surprise me", "Another kind of friend"] },
  { name: "home", label: "What's home like?", options: ["Apartment", "House with a yard", "House, no yard", "Farm or acreage"] },
  { name: "kids", label: "Kids at home?", options: ["No kids", "Little ones (under 6)", "School-age", "Teenagers"] },
  { name: "other_pets", label: "Other animals already?", options: ["None", "Dog(s)", "Cat(s)", "Dogs and cats"] },
  { name: "activity", label: "Your speed?", options: ["Cozy — couch and short strolls", "Middle — daily walks, weekend outings", "Very active — running, hiking, adventures"] },
  { name: "experience", label: "Have you had pets before?", options: ["This would be my first", "Grew up with them", "Long-time pet person"] },
];

export default function MatchQuiz({ loaderData, actionData }: Route.ComponentProps) {
  const { org, available, aiReady } = loaderData;
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const result = actionData as { matches?: MatchView[]; note?: string; error?: string } | undefined;

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-meadow text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-display font-semibold">Find your match</h1>
          <p className="mt-2 text-white/90">
            Six quick questions, and we'll point you to the friends at {org.name} most likely to love your home.
          </p>
          <Link to={`/adopt/${org.slug}`} className="mt-3 inline-block text-sm font-semibold underline text-white/90">
            or browse all {available} friend{available === 1 ? "" : "s"} →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {!aiReady && (
          <p className="rounded-blob bg-white shadow-soft p-6 text-center text-charcoal-soft">
            The matchmaker is taking a nap right now. Meanwhile, every friend is waiting on the{" "}
            <Link to={`/adopt/${org.slug}`} className="font-semibold text-meadow-deep hover:underline">adoption page</Link>.
          </p>
        )}

        {result?.matches && result.matches.length > 0 ? (
          <div>
            <h2 className="text-2xl font-display font-semibold text-center">Your matches 💛</h2>
            {result.note && <p className="mt-2 text-center text-charcoal-soft">{result.note}</p>}
            <div className="mt-6 space-y-4">
              {result.matches.map((m) => (
                <Link
                  key={m.animal_id}
                  to={`/adopt/${org.slug}/${m.animal_id}`}
                  className="flex gap-4 rounded-blob bg-white shadow-soft p-4 hover:shadow-lift transition-shadow"
                >
                  {m.photo_key ? (
                    <img src={`/api/media/${m.photo_key}`} alt={m.name} className="w-24 h-24 rounded-2xl object-cover flex-none" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-cream flex items-center justify-center flex-none">
                      <PawDoodle className="w-12 h-12 text-charcoal-soft" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-xl">{m.name}</span>
                      <span className="rounded-full bg-meadow/20 text-meadow-deep text-xs font-bold px-2 py-0.5">
                        {m.score}% match
                      </span>
                    </div>
                    {(m.breed || m.species) && (
                      <p className="text-xs text-charcoal-soft">{m.breed ?? m.species}</p>
                    )}
                    <p className="mt-1 text-sm">{m.reason}</p>
                  </div>
                </Link>
              ))}
            </div>
            <p className="mt-6 text-center">
              <Link to={`/adopt/${org.slug}`} className="font-semibold text-meadow-deep hover:underline">
                Meet everyone else too →
              </Link>
            </p>
          </div>
        ) : (
          aiReady && (
            <Form method="post" className="rounded-blob bg-white shadow-soft p-6 sm:p-8 space-y-5">
              {result?.error && (
                <p className="rounded-2xl bg-terracotta/15 text-terracotta-deep px-4 py-3 font-semibold">{result.error}</p>
              )}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              {QUESTIONS.map((q) => (
                <label key={q.name} className="block">
                  <span className="font-display font-semibold">{q.label}</span>
                  <select name={q.name} className={`mt-1.5 ${selectCls}`} defaultValue="">
                    <option value="" disabled>
                      Choose one…
                    </option>
                    {q.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="block">
                <span className="font-display font-semibold">Anything else we should know?</span>
                <textarea
                  name="extra"
                  rows={2}
                  maxLength={500}
                  placeholder="Work from home, quiet street, love long hikes…"
                  className={`mt-1.5 ${selectCls}`}
                />
              </label>
              <button
                disabled={busy}
                className="w-full rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-lg shadow-soft disabled:opacity-60"
              >
                {busy ? "Asking the matchmaker…" : "Show me my matches"}
              </button>
              <p className="text-xs text-center text-charcoal-soft">
                Suggestions come from this shelter's real, currently-adoptable animals. The shelter always has the final say on adoptions.
              </p>
            </Form>
          )
        )}
      </main>

      <footer className="py-8 text-center text-sm text-charcoal-soft">
        Powered by{" "}
        <Link to="/" className="font-semibold text-meadow-deep hover:underline">
          Tutela
        </Link>
      </footer>
    </div>
  );
}
