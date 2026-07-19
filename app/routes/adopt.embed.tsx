import type { Route } from "./+types/adopt.embed";
import { getEnv } from "../lib/auth.server";
import { parseBrandJson } from "../../workers/lib/brand";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `Adopt ${data?.animal?.name ?? "me"}` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(`SELECT id, name, slug, brand_json FROM orgs WHERE slug = ?`)
    .bind(params.slug)
    .first<Record<string, string | null>>();
  if (!org) throw new Response("Not found", { status: 404 });
  const animal = await env.DB.prepare(
    `SELECT id, name, species, breed, sex, dob, status, bonded_group_id
     FROM animals WHERE id = ? AND org_id = ? AND is_public = 1`,
  )
    .bind(params.animalId, org.id)
    .first<Record<string, unknown>>();
  if (!animal) throw new Response("Not found", { status: 404 });
  const photo = await env.DB.prepare(
    `SELECT r2_key FROM animal_photos WHERE animal_id = ? AND kind != 'video' ORDER BY created_at LIMIT 1`,
  )
    .bind(animal.id)
    .first<{ r2_key: string }>();
  const url = new URL(request.url);
  return {
    orgName: org.name,
    brand: parseBrandJson(org.brand_json),
    animal,
    photoKey: photo?.r2_key ?? null,
    pageUrl: `${url.origin}/adopt/${org.slug}/${animal.id}`,
  };
}

function ageLabel(dob: unknown): string | null {
  if (typeof dob !== "string" || !dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!isFinite(years) || years < 0) return null;
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} mo`;
  return `${Math.floor(years)} yr${years >= 2 ? "s" : ""}`;
}

/** Minimal card meant to live inside an <iframe> on partner/community sites. */
export default function AdoptEmbed({ loaderData }: Route.ComponentProps) {
  const { orgName, brand, animal, photoKey, pageUrl } = loaderData;
  const facts = [animal.breed ?? animal.species, animal.sex, ageLabel(animal.dob)].filter(Boolean).join(" · ");
  return (
    <div style={{ fontFamily: "'Nunito', Verdana, sans-serif", background: brand.palette.bg, minHeight: "100vh", padding: 12 }}>
      <a href={pageUrl} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "none", color: brand.palette.ink, display: "block" }}>
        {photoKey ? (
          <img
            src={`/api/media/${photoKey}`}
            alt={String(animal.name)}
            style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: 16, display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: 240, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
            🐾
          </div>
        )}
        <div style={{ padding: "10px 4px 0" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: brand.palette.primary }}>{String(animal.name)}</div>
          <div style={{ fontSize: 13, color: "#5c554d" }}>{facts}</div>
          {Boolean(animal.bonded_group_id) && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b85062", marginTop: 2 }}>♥ bonded pair — adopted together</div>
          )}
          <div
            style={{
              marginTop: 10, background: brand.palette.accent, color: "#fff", textAlign: "center",
              borderRadius: 999, padding: "10px 0", fontWeight: 800, fontSize: 15,
            }}
          >
            Meet {String(animal.name)} at {orgName} →
          </div>
        </div>
      </a>
    </div>
  );
}
