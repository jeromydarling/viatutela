import { useState } from "react";
import { Form, Link } from "react-router";
import type { Route } from "./+types/adopt";
import { getEnv } from "../lib/auth.server";
import { subscribeWaitlist } from "../../workers/lib/waitlist";
import {
  EMPTY_FILTER,
  FILTERS_APPEAR_AT,
  ageGroup,
  filterAnimals,
  speciesPresent,
  type AnimalFilterState,
} from "../../workers/lib/animal-filter";
import { BirdDoodle, CatDoodle, DogDoodle, PawDoodle } from "../components/doodles";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `Adopt from ${data?.org?.name ?? "a rescue"} — Via Tutela` },
    { name: "description", content: `Meet the animals waiting for homes at ${data?.org?.name ?? "this rescue"}.` },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(
    `SELECT id, name, slug, about, website, email, phone, address FROM orgs WHERE slug = ?`,
  )
    .bind(params.slug)
    .first<Record<string, string | null>>();
  if (!org) throw new Response("Not found", { status: 404 });

  const animals = await env.DB.prepare(
    `SELECT a.id, a.name, a.species, a.breed, a.sex, a.dob, a.status, a.bonded_group_id, a.description,
      (SELECT r2_key FROM animal_photos p WHERE p.animal_id = a.id LIMIT 1) photo_key
     FROM animals a
     WHERE a.org_id = ? AND a.is_public = 1 AND a.status IN ('available', 'pending', 'in foster')
     ORDER BY a.created_at DESC LIMIT 200`,
  )
    .bind(org.id)
    .all<Record<string, string | null>>();

  return { org, animals: animals.results };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const env = getEnv(context);
  const f = await request.formData();
  if (String(f.get("website") ?? "")) return { waitlist: true }; // honeypot
  if (String(f.get("intent")) !== "waitlist") return null;
  const org = await env.DB.prepare(`SELECT id FROM orgs WHERE slug = ?`).bind(params.slug).first<{ id: string }>();
  if (!org) return null;
  const ok = await subscribeWaitlist(env, {
    orgId: org.id,
    email: String(f.get("email") ?? ""),
    name: String(f.get("name") ?? ""),
    species: String(f.get("species") ?? "any"),
    keywords: String(f.get("keywords") ?? ""),
  });
  return ok ? { waitlist: true } : { waitlistError: "That email doesn't look right." };
}

const SPECIES_DOODLE: Record<string, typeof DogDoodle> = {
  dog: DogDoodle,
  cat: CatDoodle,
  bird: BirdDoodle,
};

function ageLabel(dob: string | null): string | null {
  if (!dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!isFinite(years) || years < 0) return null;
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months`;
  return `${Math.floor(years)} year${years >= 2 ? "s" : ""}`;
}

type PortalAnimal = Record<string, string | null>;

function AnimalCard({ a, orgSlug }: { a: PortalAnimal; orgSlug: string }) {
  const Doodle = SPECIES_DOODLE[a.species ?? ""] ?? PawDoodle;
  const age = ageLabel(a.dob);
  return (
    <Link
      to={`/adopt/${orgSlug}/${a.id}`}
      className="rounded-blob bg-white shadow-soft overflow-hidden hover:shadow-lift transition-shadow"
    >
      {a.photo_key ? (
        <img src={`/api/media/${a.photo_key}`} alt={`${a.name}`} className="w-full h-52 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-52 bg-cream flex items-center justify-center">
          <Doodle className="w-24 h-24 text-charcoal-soft" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-xl">{a.name}</h3>
          {a.status !== "available" && (
            <span className="text-xs font-semibold rounded-full bg-sunflower-soft px-2 py-1">
              {a.status === "pending" ? "adoption pending" : a.status}
            </span>
          )}
        </div>
        <p className="text-sm text-charcoal-soft">
          {[a.breed ?? a.species, a.sex, age].filter(Boolean).join(" · ")}
        </p>
        {a.bonded_group_id && (
          <p className="mt-1 text-xs font-semibold text-terracotta-deep">
            ♥ part of a bonded pair — they go home together
          </p>
        )}
      </div>
    </Link>
  );
}

const chipCls = (active: boolean) =>
  `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
    active ? "bg-meadow text-white" : "bg-white shadow-soft text-charcoal-soft hover:bg-sunflower-soft"
  }`;

/** The grid, with a filter bar that only appears once there's enough variety to need one. */
function FilterableAnimals({ animals, orgSlug }: { animals: PortalAnimal[]; orgSlug: string }) {
  const [f, setF] = useState<AnimalFilterState>(EMPTY_FILTER);
  const showFilters = animals.length >= FILTERS_APPEAR_AT;
  const filterable = animals.map((a) => ({
    id: String(a.id),
    name: String(a.name ?? ""),
    species: a.species,
    breed: a.breed,
    sex: a.sex,
    dob: a.dob,
    description: a.description,
    bonded_group_id: a.bonded_group_id,
  }));
  const species = speciesPresent(filterable);
  const anyBonded = filterable.some((a) => a.bonded_group_id);
  const anySenior = filterable.some((a) => ageGroup(a.dob) === "senior");
  const keptIds = new Set(filterAnimals(filterable, f).map((a) => a.id));
  const shown = animals.filter((a) => keptIds.has(String(a.id)));
  const filtering = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTER);

  return (
    <>
      <h2 className="text-2xl font-display font-semibold text-center">
        {animals.length} friend{animals.length === 1 ? "" : "s"} waiting for a way home
      </h2>

      {showFilters && (
        <div className="mt-6 rounded-blob bg-white/80 shadow-soft p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
              placeholder="Search names, breeds…"
              aria-label="Search animals"
              className="flex-1 min-w-40 rounded-full border-2 border-cream bg-cream px-4 py-2 text-sm focus:border-meadow outline-none"
            />
            <button type="button" onClick={() => setF({ ...f, species: "" })} className={chipCls(f.species === "")}>
              All
            </button>
            {species.slice(0, 5).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setF({ ...f, species: f.species === sp ? "" : sp })}
                className={chipCls(f.species === sp)}
              >
                {sp}s
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(
              [
                ["young", "🐣 young"],
                ["adult", "adult"],
                ["senior", "💛 senior"],
              ] as const
            ).map(([key, label]) =>
              key === "senior" && !anySenior ? null : (
                <button
                  key={key}
                  type="button"
                  onClick={() => setF({ ...f, age: f.age === key ? "" : key })}
                  className={chipCls(f.age === key)}
                >
                  {label}
                </button>
              ),
            )}
            <span className="w-px h-5 bg-cream" aria-hidden />
            {(["female", "male"] as const).map((sx) => (
              <button
                key={sx}
                type="button"
                onClick={() => setF({ ...f, sex: f.sex === sx ? "" : sx })}
                className={chipCls(f.sex === sx)}
              >
                {sx}
              </button>
            ))}
            {anyBonded && (
              <button type="button" onClick={() => setF({ ...f, bonded: !f.bonded })} className={chipCls(f.bonded)}>
                ♥ bonded pairs
              </button>
            )}
            {filtering && (
              <button
                type="button"
                onClick={() => setF(EMPTY_FILTER)}
                className="ml-auto text-sm font-semibold text-terracotta-deep hover:underline"
              >
                clear ({shown.length} of {animals.length})
              </button>
            )}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-lg font-semibold">No friends match those filters right now.</p>
          <p className="mt-1 text-charcoal-soft text-sm">
            Try widening the search — or scroll down and join the waitlist; we'll email you when your match arrives.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((a) => (
            <AnimalCard key={String(a.id)} a={a} orgSlug={orgSlug} />
          ))}
        </div>
      )}
    </>
  );
}

export default function AdoptPortal({ loaderData, actionData }: Route.ComponentProps) {
  const { org, animals } = loaderData;
  const wl = actionData as { waitlist?: boolean; waitlistError?: string } | undefined;
  return (
    <div>
      <header className="bg-meadow text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 text-center">
          <BirdDoodle className="w-16 h-16 mx-auto text-white/80" />
          <h1 className="mt-3 text-4xl sm:text-5xl font-display font-semibold">{org.name}</h1>
          <p className="mt-3 text-lg text-white/90 max-w-2xl mx-auto">
            {org.about ?? "Every one of these friends is ready to meet you."}
          </p>
          <Link
            to={`/adopt/${org.slug}/match`}
            className="mt-5 inline-block rounded-full bg-sunflower text-charcoal px-6 py-2.5 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow"
          >
            💛 Take the 60-second match quiz
          </Link>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm font-semibold text-white/90">
            {org.email && <span>{org.email}</span>}
            {org.phone && <span>{org.phone}</span>}
            {org.address && <span>{org.address}</span>}
            {org.website && (
              <a href={org.website} className="underline" rel="noreferrer">
                {org.website}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        {animals.length === 0 ? (
          <div className="text-center py-16">
            <img
              src="/art/rabbit.webp"
              alt=""
              width={512}
              height={512}
              className="w-32 h-32 mx-auto rounded-3xl shadow-soft -rotate-2"
            />
            <p className="mt-4 text-lg font-semibold">
              No friends looking for homes right now — check back soon.
            </p>
          </div>
        ) : (
          <FilterableAnimals animals={animals} orgSlug={String(org.slug)} />
        )}
      </main>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-14">
        <div className="rounded-blob bg-white shadow-soft p-6 sm:p-8">
          <h2 className="text-xl font-display font-semibold text-center">Waiting for someone specific? 💛</h2>
          <p className="mt-1 text-center text-sm text-charcoal-soft">
            Tell us who you're hoping for and we'll email you the moment a match arrives. One email per match, unsubscribe anytime.
          </p>
          {wl?.waitlist ? (
            <p className="mt-4 rounded-2xl bg-meadow/15 text-meadow-deep px-4 py-3 text-center font-semibold">
              You're on the list — we'll email you when your match walks in. 🐾
            </p>
          ) : (
            <Form method="post" className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="intent" value="waitlist" />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <input name="name" placeholder="Your name" className="flex-1 min-w-32 rounded-xl border-2 border-cream bg-cream px-3 py-2.5 text-sm focus:border-meadow outline-none" />
              <input name="email" type="email" required placeholder="you@example.com" className="flex-1 min-w-44 rounded-xl border-2 border-cream bg-cream px-3 py-2.5 text-sm focus:border-meadow outline-none" />
              <select name="species" className="rounded-xl border-2 border-cream bg-cream px-3 py-2.5 text-sm focus:border-meadow outline-none">
                <option value="any">Any friend</option>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="rabbit">Rabbit</option>
                <option value="other">Other</option>
              </select>
              <input name="keywords" placeholder="senior, bonded pair, small, calm…" className="w-full rounded-xl border-2 border-cream bg-cream px-3 py-2.5 text-sm focus:border-meadow outline-none" />
              {wl?.waitlistError && <p className="w-full text-sm font-semibold text-terracotta-deep">{wl.waitlistError}</p>}
              <button className="w-full rounded-full bg-sunflower px-6 py-3 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow">
                Tell me when my match arrives
              </button>
            </Form>
          )}
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-charcoal-soft">
        Powered by <Link to="/" className="font-semibold text-meadow-deep hover:underline">Via Tutela</Link> —
        peace and all good things to you and your animals.
      </footer>
    </div>
  );
}
