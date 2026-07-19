import { Link, redirect } from "react-router";
import type { Route } from "./+types/app";
import { SiteFooter } from "../components/site";
import { BirdDoodle, CatDoodle, DogDoodle, PawDoodle } from "../components/doodles";
import { getAuthedUser } from "../../workers/lib/auth";
import { cloudflareContext } from "../cloudflare-context";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Your friends — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const env = context.get(cloudflareContext).env;
  const user = await getAuthedUser(env, request);
  if (!user) throw redirect("/import");

  const animals = await env.DB.prepare(
    `SELECT a.id, a.name, a.species, a.breed, a.sex, a.status, a.bonded_group_id,
       (SELECT r2_key FROM animal_photos p WHERE p.animal_id = a.id LIMIT 1) photo_key,
       (SELECT COUNT(*) FROM medical_records m WHERE m.animal_id = a.id) medical_count,
       (SELECT COUNT(*) FROM adoptions ad WHERE ad.animal_id = a.id) adoption_count
     FROM animals a WHERE a.org_id = ? ORDER BY a.name LIMIT 500`,
  )
    .bind(user.org_id)
    .all<{
      id: string;
      name: string;
      species: string | null;
      breed: string | null;
      sex: string | null;
      status: string;
      bonded_group_id: string | null;
      photo_key: string | null;
      medical_count: number;
      adoption_count: number;
    }>();

  const counts = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM animals WHERE org_id = ?1) animals,
       (SELECT COUNT(*) FROM contacts WHERE org_id = ?1) contacts,
       (SELECT COUNT(*) FROM medical_records WHERE org_id = ?1) medical,
       (SELECT COUNT(*) FROM adoptions WHERE org_id = ?1) adoptions`,
  )
    .bind(user.org_id)
    .first<{ animals: number; contacts: number; medical: number; adoptions: number }>();

  return {
    orgName: user.org_name as string,
    animals: animals.results,
    counts: counts ?? { animals: 0, contacts: 0, medical: 0, adoptions: 0 },
  };
}

const SPECIES_DOODLE: Record<string, typeof DogDoodle> = {
  dog: DogDoodle,
  cat: CatDoodle,
  bird: BirdDoodle,
};

export default function AppDashboard({ loaderData }: Route.ComponentProps) {
  const { orgName, animals, counts } = loaderData;

  return (
    <div>
      <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-sunflower-soft">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/app" className="flex items-center gap-2 font-display font-semibold text-xl">
            <BirdDoodle className="w-9 h-9 text-meadow-deep" />
            {orgName}
          </Link>
          <span className="text-sm font-semibold text-charcoal-soft">Via Tutela · free plan</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ["friends", counts.animals],
            ["people", counts.contacts],
            ["medical records", counts.medical],
            ["adoptions", counts.adoptions],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-blob bg-white shadow-soft p-5 text-center">
              <div className="text-3xl font-display font-bold text-meadow-deep">
                {(n as number).toLocaleString()}
              </div>
              <div className="text-sm font-semibold text-charcoal-soft">{label}</div>
            </div>
          ))}
        </div>

        <h1 className="mt-12 text-2xl font-display font-semibold">Your friends</h1>
        {animals.length === 0 ? (
          <div className="mt-6 rounded-blob bg-white shadow-soft p-12 text-center">
            <PawDoodle className="w-16 h-16 mx-auto text-sunflower" />
            <p className="mt-4 text-lg font-semibold">
              No friends here yet — add your first companion to get started.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {animals.map((a) => {
              const Doodle = SPECIES_DOODLE[a.species ?? ""] ?? PawDoodle;
              return (
                <div key={a.id} className="rounded-blob bg-white shadow-soft p-5 flex gap-4">
                  {a.photo_key ? (
                    <img
                      src={`/api/media/${a.photo_key}`}
                      alt={a.name}
                      className="w-20 h-20 rounded-2xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-cream flex items-center justify-center">
                      <Doodle className="w-14 h-14 text-charcoal-soft" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-lg truncate">{a.name}</div>
                    <div className="text-sm text-charcoal-soft truncate">
                      {[a.species, a.breed, a.sex].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                      <span className="rounded-full bg-sky/20 text-sky-deep px-2 py-0.5">
                        {a.status}
                      </span>
                      {a.bonded_group_id && (
                        <span className="rounded-full bg-terracotta/20 text-terracotta-deep px-2 py-0.5">
                          bonded
                        </span>
                      )}
                      {a.medical_count > 0 && (
                        <span className="rounded-full bg-meadow/20 text-meadow-deep px-2 py-0.5">
                          {a.medical_count} medical
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
