import { Link } from "react-router";
import QRCode from "qrcode";
import type { Route } from "./+types/animal.card";
import { requireUser } from "../../lib/auth.server";
import { BirdDoodle } from "../../components/doodles";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `Kennel card — ${data?.animal?.name ?? ""} — Via Tutela` }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const animal = await env.DB.prepare(
    `SELECT id, name, species, breed, sex, dob, status, kennel, microchip, description
     FROM animals WHERE id = ? AND org_id = ?`,
  )
    .bind(params.animalId, user.org_id)
    .first<Record<string, string | null>>();
  if (!animal) throw new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const qrSvg = await QRCode.toString(`${origin}/a/${animal.id}`, {
    type: "svg",
    margin: 1,
    width: 240,
    color: { dark: "#2e2a26", light: "#ffffff" },
  });

  return { animal, qrSvg, orgName: user.org_name };
}

export default function KennelCard({ loaderData }: Route.ComponentProps) {
  const { animal, qrSvg, orgName } = loaderData;
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/app/animals/${animal.id}`} className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">
          ← Back to {animal.name}
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-full bg-sunflower px-5 py-2.5 font-display font-semibold shadow-soft"
        >
          Print card
        </button>
      </div>

      <div className="mt-6 rounded-blob bg-white shadow-lift p-8 border-4 border-sunflower print:shadow-none print:border-2">
        <div className="flex items-center gap-2 text-charcoal-soft">
          <BirdDoodle className="w-8 h-8 text-meadow-deep" />
          <span className="font-display font-semibold">{orgName}</span>
        </div>
        <div className="mt-4 flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-display font-bold">{animal.name}</h1>
            <dl className="mt-3 space-y-1 text-lg">
              {animal.kennel && (
                <div className="font-display text-2xl font-semibold text-meadow-deep">
                  Kennel {animal.kennel}
                </div>
              )}
              <div>{[animal.species, animal.breed].filter(Boolean).join(" · ")}</div>
              <div>{[animal.sex, animal.dob && `born ${animal.dob}`].filter(Boolean).join(" · ")}</div>
              <div className="font-semibold">{animal.status}</div>
              {animal.microchip && <div className="text-sm">chip {animal.microchip}</div>}
            </dl>
          </div>
          <div
            className="shrink-0 w-40 h-40 sm:w-56 sm:h-56"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-charcoal-soft">
          Scan for the full profile — no more walking back to the office.
        </p>
      </div>
    </div>
  );
}
