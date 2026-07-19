import { Form, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/animals";
import { requireUser } from "../../lib/auth.server";
import { CatDoodle, DogDoodle, PawDoodle, BirdDoodle } from "../../components/doodles";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Animals — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status") ?? "";
  const species = url.searchParams.get("species") ?? "";
  const location = url.searchParams.get("location") ?? "";

  let sql = `SELECT a.id, a.name, a.species, a.breed, a.sex, a.status, a.kennel, a.bonded_group_id, a.is_public,
    l.name location_name,
    (SELECT r2_key FROM animal_photos p WHERE p.animal_id = a.id LIMIT 1) photo_key
    FROM animals a LEFT JOIN locations l ON l.id = a.location_id WHERE a.org_id = ?`;
  const binds: unknown[] = [user.org_id];
  if (location) {
    sql += ` AND a.location_id = ?`;
    binds.push(location);
  }
  if (q) {
    sql += ` AND (a.name LIKE ? OR a.breed LIKE ? OR a.microchip = ? OR a.kennel = ?)`;
    binds.push(`%${q}%`, `%${q}%`, q, q);
  }
  if (status) {
    sql += ` AND a.status = ?`;
    binds.push(status);
  }
  if (species) {
    sql += ` AND a.species = ?`;
    binds.push(species);
  }
  sql += ` ORDER BY a.name LIMIT 500`;

  const [animals, speciesList, statusList, locationList] = await Promise.all([
    env.DB.prepare(sql).bind(...binds).all<Record<string, string>>(),
    env.DB.prepare(`SELECT DISTINCT species FROM animals WHERE org_id = ? AND species IS NOT NULL ORDER BY species`)
      .bind(user.org_id).all<{ species: string }>(),
    env.DB.prepare(`SELECT DISTINCT status FROM animals WHERE org_id = ? ORDER BY status`)
      .bind(user.org_id).all<{ status: string }>(),
    env.DB.prepare(`SELECT id, name FROM locations WHERE org_id = ? ORDER BY name`)
      .bind(user.org_id).all<{ id: string; name: string }>(),
  ]);

  return {
    animals: animals.results,
    speciesOptions: speciesList.results.map((r) => r.species),
    statusOptions: statusList.results.map((r) => r.status),
    locationOptions: locationList.results,
  };
}

const SPECIES_DOODLE: Record<string, typeof DogDoodle> = {
  dog: DogDoodle,
  cat: CatDoodle,
  bird: BirdDoodle,
};

export default function Animals({ loaderData }: Route.ComponentProps) {
  const { animals, speciesOptions, statusOptions, locationOptions } = loaderData;
  const [params] = useSearchParams();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-semibold">Your friends ({animals.length})</h1>
        <Link
          to="/app/animals/new"
          className="rounded-full bg-sunflower px-5 py-2.5 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow"
        >
          + Add a friend
        </Link>
      </div>

      <Form method="get" className="mt-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search name, breed, chip, kennel…"
          className="flex-1 min-w-48 rounded-xl border-2 border-cream bg-white px-4 py-2 focus:border-meadow outline-none"
        />
        <select name="species" defaultValue={params.get("species") ?? ""} className="rounded-xl border-2 border-cream bg-white px-3 py-2">
          <option value="">All species</option>
          {speciesOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="status" defaultValue={params.get("status") ?? ""} className="rounded-xl border-2 border-cream bg-white px-3 py-2">
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {locationOptions.length > 0 && (
          <select name="location" defaultValue={params.get("location") ?? ""} className="rounded-xl border-2 border-cream bg-white px-3 py-2">
            <option value="">All locations</option>
            {locationOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        <button className="rounded-full bg-meadow text-white px-5 py-2 font-semibold">Filter</button>
      </Form>

      {animals.length === 0 ? (
        <div className="mt-10 rounded-blob bg-white shadow-soft p-12 text-center">
          <PawDoodle className="w-16 h-16 mx-auto text-sunflower" />
          <p className="mt-4 text-lg font-semibold">
            No friends here yet — add your first companion to get started.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {animals.map((a) => {
            const Doodle = SPECIES_DOODLE[a.species ?? ""] ?? PawDoodle;
            return (
              <Link
                key={a.id}
                to={`/app/animals/${a.id}`}
                prefetch="intent"
                className="rounded-blob bg-white shadow-soft p-4 flex gap-3 hover:shadow-lift transition-shadow"
              >
                {a.photo_key ? (
                  <img
                    src={`/api/media/${a.photo_key}`}
                    alt=""
                    className="w-16 h-16 rounded-2xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-cream flex items-center justify-center shrink-0">
                    <Doodle className="w-11 h-11 text-charcoal-soft" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">{a.name}</div>
                  <div className="text-xs text-charcoal-soft truncate">
                    {[a.species, a.breed].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold">
                    <span className="rounded-full bg-sky/20 text-sky-deep px-2 py-0.5">{a.status}</span>
                    {a.kennel && (
                      <span className="rounded-full bg-sunflower-soft px-2 py-0.5">{a.kennel}</span>
                    )}
                    {a.location_name && (
                      <span className="rounded-full bg-meadow/15 text-meadow-deep px-2 py-0.5">{a.location_name}</span>
                    )}
                    {a.bonded_group_id && (
                      <span className="rounded-full bg-terracotta/20 text-terracotta-deep px-2 py-0.5">bonded</span>
                    )}
                    {!a.is_public && (
                      <span className="rounded-full bg-charcoal/10 px-2 py-0.5">hidden</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
