import { Form, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/find";
import { getEnv } from "../lib/auth.server";
import { marketingMeta } from "../lib/seo";
import { ageGroup } from "../../workers/lib/animal-filter";
import { US_STATES, subscribeAdoptAlert } from "../../workers/lib/adopt-alerts";
import { SiteHeader, SiteFooter } from "../components/site";
import { BirdDoodle, CatDoodle, DogDoodle, PawDoodle } from "../components/doodles";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "Adopt a Pet Near You — Search Every Tutela Shelter",
    description:
      "One search across every shelter and rescue on Tutela: dogs, cats, and more waiting for homes. Set a free alert and we'll email you the moment your friend arrives.",
    path: "/find",
  });
}

const PAGE_SIZE = 60;

export async function loader({ context, request }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const species = url.searchParams.get("species")?.trim().toLowerCase() ?? "";
  const state = url.searchParams.get("state")?.trim().toUpperCase() ?? "";
  const age = url.searchParams.get("age") ?? "";
  const sex = url.searchParams.get("sex") ?? "";

  // demo animals are generated art — they must never appear beside real listings
  let sql = `SELECT a.id, a.name, a.species, a.breed, a.sex, a.dob, a.description, a.bonded_group_id, a.created_at,
      o.name org_name, o.slug org_slug, o.state org_state,
      (SELECT r2_key FROM animal_photos p WHERE p.animal_id = a.id LIMIT 1) photo_key
    FROM animals a JOIN orgs o ON o.id = a.org_id
    WHERE a.is_public = 1 AND a.status = 'available' AND o.demo = 0`;
  const binds: unknown[] = [];
  if (species) {
    sql += ` AND lower(a.species) = ?`;
    binds.push(species);
  }
  if (state) {
    sql += ` AND o.state = ?`;
    binds.push(state);
  }
  if (sex === "male" || sex === "female") {
    sql += ` AND a.sex = ?`;
    binds.push(sex);
  }
  if (q) {
    sql += ` AND (lower(a.name) LIKE ? OR lower(a.breed) LIKE ? OR lower(a.description) LIKE ?)`;
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ` ORDER BY a.created_at DESC LIMIT 400`;

  const [rows, speciesRows] = await Promise.all([
    env.DB.prepare(sql).bind(...binds).all<Record<string, string | null>>(),
    env.DB.prepare(
      `SELECT DISTINCT lower(a.species) s FROM animals a JOIN orgs o ON o.id = a.org_id
       WHERE a.is_public = 1 AND a.status = 'available' AND o.demo = 0 AND a.species IS NOT NULL ORDER BY s`,
    ).all<{ s: string }>(),
  ]);

  const filtered = age
    ? rows.results.filter((a) => ageGroup(a.dob) === age)
    : rows.results;

  return {
    animals: filtered.slice(0, PAGE_SIZE),
    total: filtered.length,
    speciesOptions: speciesRows.results.map((r) => r.s),
    states: US_STATES,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const env = getEnv(context);
  const f = await request.formData();
  if (String(f.get("website") ?? "")) return { alert: true }; // honeypot
  if (String(f.get("intent")) !== "alert") return null;
  const ok = await subscribeAdoptAlert(env, {
    email: String(f.get("email") ?? ""),
    species: String(f.get("alert_species") ?? "any"),
    keywords: String(f.get("keywords") ?? ""),
    state: String(f.get("alert_state") ?? ""),
  });
  return ok ? { alert: true } : { alertError: "That email doesn't look right." };
}

const SPECIES_DOODLE: Record<string, typeof DogDoodle> = { dog: DogDoodle, cat: CatDoodle, bird: BirdDoodle };
const selectCls = "rounded-xl border-2 border-cream bg-white px-3 py-2 text-sm";

export default function Find({ loaderData, actionData }: Route.ComponentProps) {
  const { animals, total, speciesOptions, states } = loaderData;
  const [params] = useSearchParams();
  const a = actionData as { alert?: boolean; alertError?: string } | undefined;

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <header className="bg-meadow text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-display font-semibold">Find your friend</h1>
          <p className="mt-2 text-white/90 text-lg">
            One search across every shelter and rescue on Tutela — updated the moment a new friend arrives.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <Form method="get" className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Search names, breeds…"
            className="flex-1 min-w-44 rounded-xl border-2 border-cream bg-white px-4 py-2 focus:border-meadow outline-none"
          />
          <select name="species" defaultValue={params.get("species") ?? ""} className={selectCls}>
            <option value="">All species</option>
            {speciesOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select name="state" defaultValue={params.get("state") ?? ""} className={selectCls}>
            <option value="">Anywhere in the US</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select name="age" defaultValue={params.get("age") ?? ""} className={selectCls}>
            <option value="">Any age</option>
            <option value="young">Young</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior</option>
          </select>
          <select name="sex" defaultValue={params.get("sex") ?? ""} className={selectCls}>
            <option value="">Any sex</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <button className="rounded-full bg-meadow text-white px-5 py-2 font-semibold">Search</button>
        </Form>

        <p className="mt-4 text-sm text-charcoal-soft">
          {total === 0
            ? "No friends match that search right now — set an alert below and we'll email you the moment one arrives."
            : `${total} friend${total === 1 ? "" : "s"} waiting${total > PAGE_SIZE ? ` (showing the ${PAGE_SIZE} newest)` : ""}`}
        </p>

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {animals.map((an) => {
            const Doodle = SPECIES_DOODLE[an.species ?? ""] ?? PawDoodle;
            return (
              <Link
                key={String(an.id)}
                to={`/adopt/${an.org_slug}/${an.id}`}
                className="rounded-blob bg-white shadow-soft overflow-hidden hover:shadow-lift transition-shadow"
              >
                {an.photo_key ? (
                  <img src={`/api/media/${an.photo_key}?w=480`} alt={String(an.name)} className="w-full h-44 object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-44 bg-cream flex items-center justify-center">
                    <Doodle className="w-16 h-16 text-charcoal-soft" />
                  </div>
                )}
                <div className="p-3">
                  <div className="font-display font-semibold">{an.name}</div>
                  <div className="text-xs text-charcoal-soft truncate">
                    {[an.breed ?? an.species, an.sex].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1 text-xs text-charcoal-soft truncate">
                    {an.org_name}{an.org_state ? ` · ${an.org_state}` : ""}
                  </div>
                  {an.bonded_group_id && (
                    <div className="mt-1 text-[11px] font-semibold text-terracotta-deep">♥ bonded pair</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <section className="mt-12 rounded-blob bg-white shadow-soft p-6 sm:p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-display font-semibold text-center">Let your friend find you</h2>
          <p className="mt-1 text-sm text-charcoal-soft text-center">
            Tell us what you're hoping for and we'll email you the moment a match arrives at any shelter on
            Tutela. Free, and one click to stop.
          </p>
          {a?.alert ? (
            <p className="mt-4 rounded-2xl bg-meadow/15 text-meadow-deep px-4 py-3 font-semibold text-center">
              Alert set! We'll email you when a match arrives. 🐾
            </p>
          ) : (
            <Form method="post" className="mt-4 grid sm:grid-cols-2 gap-2">
              <input type="hidden" name="intent" value="alert" />
              <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
              <input name="email" type="email" required placeholder="you@example.com *" className="rounded-xl border-2 border-cream bg-cream px-3 py-2 sm:col-span-2 focus:border-meadow outline-none" />
              <select name="alert_species" className={selectCls}>
                <option value="any">Any species</option>
                {["dog", "cat", "rabbit", "bird"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select name="alert_state" className={selectCls}>
                <option value="">Anywhere in the US</option>
                {states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input name="keywords" placeholder="e.g. senior, bonded, lap cat, husky" className="rounded-xl border-2 border-cream bg-cream px-3 py-2 sm:col-span-2 focus:border-meadow outline-none" />
              {a?.alertError && <p className="sm:col-span-2 text-sm font-semibold text-terracotta-deep">{a.alertError}</p>}
              <button className="sm:col-span-2 rounded-full bg-sunflower px-5 py-2.5 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow">
                Set my alert
              </button>
            </Form>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
