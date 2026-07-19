import { Link } from "react-router";
import type { Route } from "./+types/adopt";
import { getEnv } from "../lib/auth.server";
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

export default function AdoptPortal({ loaderData }: Route.ComponentProps) {
  const { org, animals } = loaderData;
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
          <>
            <h2 className="text-2xl font-display font-semibold text-center">
              {animals.length} friend{animals.length === 1 ? "" : "s"} waiting for a way home
            </h2>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {animals.map((a) => {
                const Doodle = SPECIES_DOODLE[a.species ?? ""] ?? PawDoodle;
                const age = ageLabel(a.dob);
                return (
                  <Link
                    key={a.id}
                    to={`/adopt/${org.slug}/${a.id}`}
                    className="rounded-blob bg-white shadow-soft overflow-hidden hover:shadow-lift transition-shadow"
                  >
                    {a.photo_key ? (
                      <img
                        src={`/api/media/${a.photo_key}`}
                        alt={`${a.name}`}
                        className="w-full h-52 object-cover"
                        loading="lazy"
                      />
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
              })}
            </div>
          </>
        )}
      </main>

      <footer className="py-8 text-center text-sm text-charcoal-soft">
        Powered by <Link to="/" className="font-semibold text-meadow-deep hover:underline">Via Tutela</Link> —
        peace and all good things to you and your animals.
      </footer>
    </div>
  );
}
