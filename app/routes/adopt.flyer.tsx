import QRCode from "qrcode";
import type { Route } from "./+types/adopt.flyer";
import { getEnv } from "../lib/auth.server";
import { parseBrandJson, FONT_PAIRS, WORDMARK_FONTS, wordmarkStyle, wordmarkText } from "../../workers/lib/brand";
import { brandFontsHref } from "../../workers/lib/brand";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: `Adopt ${data?.animal?.name ?? "me"} — printable flyer` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(
    `SELECT id, name, slug, email, phone, address, brand_json FROM orgs WHERE slug = ?`,
  )
    .bind(params.slug)
    .first<Record<string, string | null>>();
  if (!org) throw new Response("Not found", { status: 404 });

  const animal = await env.DB.prepare(
    `SELECT id, name, species, breed, sex, dob, altered, description, bonded_group_id
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
  const pageUrl = `${url.origin}/adopt/${org.slug}/${animal.id}`;
  const qrSvg = await QRCode.toString(pageUrl, { type: "svg", margin: 1, width: 220 });

  return {
    org: { name: org.name, email: org.email, phone: org.phone, address: org.address },
    brand: parseBrandJson(org.brand_json),
    animal,
    photoKey: photo?.r2_key ?? null,
    qrSvg,
    pageUrl,
  };
}

function ageLabel(dob: unknown): string | null {
  if (typeof dob !== "string" || !dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!isFinite(years) || years < 0) return null;
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months`;
  return `${Math.floor(years)} year${years >= 2 ? "s" : ""}`;
}

export default function AdoptFlyer({ loaderData }: Route.ComponentProps) {
  const { org, brand, animal, photoKey, qrSvg } = loaderData;
  const pair = FONT_PAIRS[brand.typography] ?? FONT_PAIRS.friendly;
  const wm = WORDMARK_FONTS[brand.wordmark.font] ?? WORDMARK_FONTS.fredoka;
  const facts = [animal.breed ?? animal.species, animal.sex, ageLabel(animal.dob), Boolean(animal.altered) && "spayed/neutered"]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <link rel="stylesheet" href={brandFontsHref(brand)} />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.5in; }
        }
        .flyer { font-family: ${pair.body}; color: ${brand.palette.ink}; }
        .flyer h1, .flyer h2 { font-family: ${pair.heading}; }
      `}</style>

      <div className="no-print" style={{ padding: "12px", textAlign: "center", background: "#fff9f0" }}>
        <button
          onClick={() => window.print()}
          style={{
            background: brand.palette.accent, color: "#fff", border: 0, borderRadius: 999,
            padding: "12px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}
        >
          🖨️ Print / Save as PDF
        </button>
        <span style={{ marginLeft: 12, fontSize: 13, color: "#5c554d" }}>
          Tip: choose "Save as PDF" in the print dialog to get a shareable file.
        </span>
      </div>

      <div className="flyer" style={{ maxWidth: "7.5in", margin: "0 auto", padding: "24px" }}>
        <div style={{ textAlign: "center", borderBottom: `4px solid ${brand.palette.primary}`, paddingBottom: 16 }}>
          {brand.logo.kind === "image" && brand.logo.imageUrl ? (
            <img src={brand.logo.imageUrl} alt={`${org.name} logo`} style={{ height: 56, margin: "0 auto" }} />
          ) : (
            <div style={{ ...(wordmarkStyle(brand) as React.CSSProperties), fontFamily: wm.css, fontSize: 34 }}>
              {wordmarkText(String(org.name), brand)}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 15, color: brand.palette.primary, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Looking for a home
          </div>
        </div>

        <h1 style={{ fontSize: 64, textAlign: "center", margin: "18px 0 4px", color: brand.palette.primary, lineHeight: 1 }}>
          {String(animal.name)}
        </h1>
        <p style={{ textAlign: "center", fontSize: 19, margin: "0 0 18px", color: brand.palette.ink }}>{facts}</p>

        {photoKey && (
          <img
            src={`/api/media/${photoKey}`}
            alt={String(animal.name)}
            style={{ width: "100%", maxHeight: "4.6in", objectFit: "cover", borderRadius: 24, display: "block" }}
          />
        )}

        {Boolean(animal.description) && (
          <p style={{ fontSize: 17, lineHeight: 1.55, margin: "18px 0" }}>{String(animal.description).slice(0, 700)}</p>
        )}
        {Boolean(animal.bonded_group_id) && (
          <p style={{ fontWeight: 700, color: "#b85062", margin: "0 0 14px" }}>
            ♥ {String(animal.name)} is part of a bonded pair — they go home together.
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, background: brand.palette.bg, borderRadius: 24, padding: 18 }}>
          <div
            style={{ width: 130, flexShrink: 0, background: "#fff", borderRadius: 14, padding: 8 }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div>
            <h2 style={{ fontSize: 22, margin: 0, color: brand.palette.primary }}>Scan to meet {String(animal.name)}</h2>
            <p style={{ margin: "6px 0 0", fontSize: 15 }}>
              Photos, videos, and the application live behind this code — or reach {org.name} directly:
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700 }}>
              {[org.email, org.phone, org.address].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {brand.tagline && (
          <p style={{ textAlign: "center", marginTop: 14, fontStyle: "italic", color: brand.palette.primary }}>{brand.tagline}</p>
        )}
      </div>
    </div>
  );
}
