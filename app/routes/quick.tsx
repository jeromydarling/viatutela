import { Link } from "react-router";
import type { Route } from "./+types/quick";
import { getEnv } from "../lib/auth.server";
import { getAuthedUser } from "../../workers/lib/auth";
import { CatDoodle, DogDoodle, PawDoodle } from "../components/doodles";

/**
 * Kennel QR target: scan on a phone, see the profile in seconds.
 * Staff signed in to the animal's org see everything (medical, chip, notes);
 * everyone else sees the public adoption view or a gentle nudge.
 */

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.animal?.name ?? "Friend"} — Via Tutela` }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const user = await getAuthedUser(env, request);

  const animal = await env.DB.prepare(
    `SELECT a.*, o.slug org_slug, o.name org_name FROM animals a
     JOIN orgs o ON o.id = a.org_id WHERE a.id = ?`,
  )
    .bind(params.animalId)
    .first<Record<string, unknown>>();
  if (!animal) throw new Response("Not found", { status: 404 });

  const isStaff = user?.org_id === animal.org_id;
  if (!isStaff && !animal.is_public) {
    // not public and not staff: don't leak anything beyond existence of the org
    throw new Response("Not found", { status: 404 });
  }

  const photos = await env.DB.prepare(
    `SELECT r2_key FROM animal_photos WHERE animal_id = ? ORDER BY created_at LIMIT 4`,
  )
    .bind(animal.id)
    .all<{ r2_key: string }>();

  let medical: Record<string, unknown>[] = [];
  let activeFoster: Record<string, unknown> | null = null;
  if (isStaff) {
    const [med, fos] = await Promise.all([
      env.DB.prepare(
        `SELECT date, type, description, vet FROM medical_records WHERE animal_id = ? ORDER BY date DESC LIMIT 10`,
      ).bind(animal.id).all<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT fa.start_date, c.name contact_name, c.phone FROM foster_assignments fa
         JOIN contacts c ON c.id = fa.contact_id WHERE fa.animal_id = ? AND fa.active = 1 LIMIT 1`,
      ).bind(animal.id).first<Record<string, unknown>>(),
    ]);
    medical = med.results;
    activeFoster = fos ?? null;
  }

  return { animal, photos: photos.results, medical, activeFoster, isStaff };
}

export default function QuickLookup({ loaderData }: Route.ComponentProps) {
  const { animal, photos, medical, activeFoster, isStaff } = loaderData;
  const Doodle = animal.species === "cat" ? CatDoodle : animal.species === "dog" ? DogDoodle : PawDoodle;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      {photos.length > 0 ? (
        <img
          src={`/api/media/${photos[0].r2_key}`}
          alt={String(animal.name)}
          className="w-full h-64 object-cover rounded-blob shadow-soft"
        />
      ) : (
        <div className="w-full h-40 rounded-blob bg-white shadow-soft flex items-center justify-center">
          <Doodle className="w-24 h-24 text-charcoal-soft" />
        </div>
      )}

      <h1 className="mt-4 text-3xl font-display font-bold">{String(animal.name)}</h1>
      <p className="text-charcoal-soft">
        {[animal.species, animal.breed, animal.sex].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-sky/20 text-sky-deep px-2 py-1">{String(animal.status)}</span>
        {Boolean(animal.kennel) && (
          <span className="rounded-full bg-sunflower-soft px-2 py-1">kennel {String(animal.kennel)}</span>
        )}
        {Boolean(animal.altered) && (
          <span className="rounded-full bg-meadow/20 text-meadow-deep px-2 py-1">s/n</span>
        )}
      </div>

      <dl className="mt-4 rounded-blob bg-white shadow-soft p-5 space-y-2 text-sm">
        {animal.dob && (
          <div className="flex justify-between"><dt className="font-semibold">Born</dt><dd>{String(animal.dob)}</dd></div>
        )}
        {animal.intake_date && (
          <div className="flex justify-between"><dt className="font-semibold">Intake</dt><dd>{String(animal.intake_date)}</dd></div>
        )}
        {isStaff && animal.microchip && (
          <div className="flex justify-between"><dt className="font-semibold">Chip</dt><dd>{String(animal.microchip)}</dd></div>
        )}
        {animal.weight && (
          <div className="flex justify-between"><dt className="font-semibold">Weight</dt><dd>{String(animal.weight)}</dd></div>
        )}
        {Boolean(animal.description) && <p className="pt-2 border-t border-cream">{String(animal.description)}</p>}
      </dl>

      {isStaff && activeFoster && (
        <p className="mt-3 rounded-2xl bg-meadow/15 text-meadow-deep px-4 py-3 text-sm font-semibold">
          In foster with {String(activeFoster.contact_name)}
          {activeFoster.phone ? ` · ${activeFoster.phone}` : ""} since {String(activeFoster.start_date ?? "—")}
        </p>
      )}

      {isStaff && (
        <section className="mt-4 rounded-blob bg-white shadow-soft p-5">
          <h2 className="font-display font-semibold">Recent medical</h2>
          {medical.length === 0 ? (
            <p className="mt-1 text-sm text-charcoal-soft">No records.</p>
          ) : (
            <ul className="mt-2 text-sm divide-y divide-cream">
              {medical.map((m, i) => (
                <li key={i} className="py-1.5">
                  <span className="text-charcoal-soft">{String(m.date ?? "—")}</span>{" "}
                  <strong>{String(m.type ?? "")}</strong> {String(m.description ?? "")}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {isStaff ? (
          <Link
            to={`/app/animals/${animal.id}`}
            className="text-center rounded-full bg-meadow text-white px-6 py-3 font-display font-semibold shadow-soft"
          >
            Open full record
          </Link>
        ) : (
          <Link
            to={`/adopt/${animal.org_slug}/${animal.id}`}
            className="text-center rounded-full bg-sunflower px-6 py-3 font-display font-semibold shadow-soft"
          >
            Ask about {String(animal.name)}
          </Link>
        )}
        <Link to={`/adopt/${animal.org_slug}`} className="text-center text-sm font-semibold text-charcoal-soft">
          {String(animal.org_name)}
        </Link>
      </div>
    </main>
  );
}
