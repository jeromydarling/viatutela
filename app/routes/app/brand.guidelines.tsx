import { Link } from "react-router";
import type { Route } from "./+types/brand.guidelines";
import { requireUser } from "../../lib/auth.server";
import { FONT_PAIRS, WORDMARK_FONTS, parseBrandJson, wordmarkStyle, wordmarkText, type Brand } from "../../../workers/lib/brand";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Brand guidelines — Via Tutela" }];
}

const STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?" +
  [...new Set([...Object.values(WORDMARK_FONTS).map((f) => f.google), ...Object.values(FONT_PAIRS).flatMap((p) => p.google)])]
    .map((f) => `family=${f}`)
    .join("&") +
  "&display=swap";

export function links() {
  return [{ rel: "stylesheet", href: STUDIO_FONTS }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = await env.DB.prepare(`SELECT name, brand_json FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ name: string; brand_json: string | null }>();
  return { orgName: org?.name ?? "", brand: parseBrandJson(org?.brand_json ?? null) };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Social templates as self-contained SVGs rendered from the tokens. */
function makeTemplates(orgName: string, brand: Brand): { name: string; w: number; h: number; svg: string }[] {
  const font = WORDMARK_FONTS[brand.wordmark.font]?.css ?? "sans-serif";
  const text = esc(wordmarkText(orgName, brand));
  const tagline = esc(brand.tagline || "every friend deserves a way home");
  const p = brand.palette;
  const common = `font-family=${JSON.stringify(font)} font-weight="${brand.wordmark.weight}" letter-spacing="${(brand.wordmark.tracking / 1000).toFixed(3)}em"`;

  const initial = esc((orgName.trim()[0] ?? "V").toUpperCase());
  const profile = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${p.primary}"/>
  <circle cx="512" cy="512" r="430" fill="${p.bg}"/>
  <text x="512" y="600" text-anchor="middle" font-size="440" fill="${p.primary}" ${common}>${initial}</text>
</svg>`;

  const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="624" viewBox="0 0 1640 624">
  <rect width="1640" height="624" fill="${p.bg}"/>
  <rect y="524" width="1640" height="100" fill="${p.primary}"/>
  <circle cx="1420" cy="140" r="220" fill="${p.accent}" opacity="0.25"/>
  <text x="90" y="300" font-size="96" fill="${p.primary}" ${common}>${text}</text>
  <text x="92" y="380" font-size="40" fill="${p.ink}" font-family=${JSON.stringify(font)}>${tagline}</text>
</svg>`;

  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${p.primary}"/>
  <rect x="40" y="40" width="1120" height="550" rx="48" fill="${p.bg}"/>
  <text x="600" y="300" text-anchor="middle" font-size="84" fill="${p.primary}" ${common}>${text}</text>
  <text x="600" y="390" text-anchor="middle" font-size="36" fill="${p.ink}" font-family=${JSON.stringify(font)}>${tagline}</text>
  <rect x="460" y="450" width="280" height="70" rx="35" fill="${p.accent}"/>
  <text x="600" y="497" text-anchor="middle" font-size="32" fill="${p.bg}" font-weight="700" font-family=${JSON.stringify(font)}>Adopt · Donate</text>
</svg>`;

  return [
    { name: "profile-picture-1024.svg", w: 1024, h: 1024, svg: profile },
    { name: "cover-facebook-1640x624.svg", w: 1640, h: 624, svg: cover },
    { name: "share-card-1200x630.svg", w: 1200, h: 630, svg: og },
  ];
}

export default function BrandGuidelines({ loaderData }: Route.ComponentProps) {
  const { orgName, brand } = loaderData;
  const pair = FONT_PAIRS[brand.typography] ?? FONT_PAIRS.friendly;
  const templates = makeTemplates(orgName, brand);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/brand" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Brand Studio</Link>
        <h1 className="text-2xl font-display font-semibold">How to use the {orgName} brand</h1>
        <p className="text-sm text-charcoal-soft">Share this page with volunteers — everything here is safe to copy.</p>
      </div>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-xl">Our colors</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(
            [
              ["Primary", brand.palette.primary, "headers, links, structure"],
              ["Accent", brand.palette.accent, "donate & adopt buttons"],
              ["Ink", brand.palette.ink, "body text"],
              ["Background", brand.palette.bg, "page backgrounds"],
            ] as const
          ).map(([name, hexv, use]) => (
            <div key={name} className="rounded-2xl overflow-hidden border-2 border-cream">
              <div className="h-20" style={{ background: hexv }} />
              <div className="p-3">
                <div className="font-semibold text-sm">{name}</div>
                <code className="text-xs">{hexv}</code>
                <div className="text-xs text-charcoal-soft mt-0.5">{use}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-xl">Our logo & type</h2>
        <div className="mt-4 rounded-2xl p-8 text-center" style={{ background: brand.palette.bg }}>
          {brand.logo.kind === "image" && brand.logo.imageUrl ? (
            <img src={brand.logo.imageUrl} alt={`${orgName} logo`} className="h-20 mx-auto" />
          ) : (
            <div className="text-4xl" style={wordmarkStyle(brand)}>{wordmarkText(orgName, brand)}</div>
          )}
          {brand.tagline && <p className="mt-2 text-sm" style={{ color: brand.palette.ink }}>{brand.tagline}</p>}
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl bg-cream p-4">
            <div className="text-2xl" style={{ fontFamily: pair.heading }}>Headings look like this</div>
            <div className="mt-2" style={{ fontFamily: pair.body }}>
              Body text looks like this — friendly and easy to read at any size.
            </div>
          </div>
          <ul className="rounded-2xl bg-cream p-4 space-y-1.5">
            <li>✓ Give the logo breathing room</li>
            <li>✓ Use Accent only for the main action</li>
            <li>✗ Don't stretch, recolor, or add effects</li>
            <li>✗ Don't put the wordmark on busy photos</li>
          </ul>
        </div>
        <p className="mt-3 text-xs text-charcoal-soft">
          Our voice: <em>{brand.voice}</em>
        </p>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-xl">Social kit — ready-made assets</h2>
        <p className="text-sm text-charcoal-soft mt-1">
          Right-size, on-brand, no design skills needed. Download and upload straight to Facebook / Instagram.
        </p>
        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.name} className="rounded-2xl border-2 border-cream p-3">
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(t.svg)}`}
                alt={t.name}
                className="w-full rounded-xl border border-cream"
                style={{ aspectRatio: `${t.w}/${t.h}` }}
              />
              <a
                download={t.name}
                href={`data:image/svg+xml;utf8,${encodeURIComponent(t.svg)}`}
                className="mt-2 block text-center rounded-full bg-sunflower px-3 py-1.5 text-xs font-semibold shadow-soft"
              >
                Download {t.name.split("-")[0]}
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
