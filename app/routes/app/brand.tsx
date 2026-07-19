import { aiAvailable } from "../../../workers/lib/ai-flags";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/brand";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { getAnthropic, logAiWrite } from "../../../workers/lib/ai";
import { generateBrandProposal } from "../../../workers/lib/brand-ai";
import {
  FONT_PAIRS,
  WORDMARK_FONTS,
  SITE_THEMES,
  parseBrandJson,
  validateBrand,
  scrapeHomepage,
  wordmarkStyle,
  wordmarkText,
  type Brand,
} from "../../../workers/lib/brand";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Brand Studio — Tutela" }];
}

const ALL_STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?" +
  [...new Set([...Object.values(WORDMARK_FONTS).map((f) => f.google), ...Object.values(FONT_PAIRS).flatMap((p) => p.google)])]
    .map((f) => `family=${f}`)
    .join("&") +
  "&display=swap";

export function links() {
  return [{ rel: "stylesheet", href: ALL_STUDIO_FONTS }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = await env.DB.prepare(`SELECT name, brand_json FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ name: string; brand_json: string | null }>();
  const media = await env.DB.prepare(
    `SELECT r2_key, alt FROM media WHERE org_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(user.org_id)
    .all<{ r2_key: string; alt: string }>();
  return {
    orgName: org?.name ?? "",
    brand: parseBrandJson(org?.brand_json ?? null),
    media: media.results,
    aiReady: aiAvailable(env),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const str = (k: string) => String(f.get(k) ?? "").trim();

  if (intent === "save") {
    const brand = validateBrand({
      palette: { primary: str("primary"), accent: str("accent"), ink: str("ink"), bg: str("bg") },
      logo: { kind: str("logo_kind"), imageUrl: str("logo_image_url") || null },
      wordmark: { font: str("wm_font"), case: str("wm_case"), tracking: str("wm_tracking"), weight: str("wm_weight") },
      typography: str("typography"),
      theme: str("theme"),
      tagline: str("tagline"),
      voice: str("voice"),
    });
    await env.DB.prepare(`UPDATE orgs SET brand_json = ? WHERE id = ?`)
      .bind(JSON.stringify(brand), user.org_id)
      .run();
    return { ok: "Brand saved — every page, email, and template now uses it." };
  }

  if (intent === "ai-propose") {
    const about = str("about");
    const vibe = str("vibe");
    if (!about) return { error: "Tell the AI what your shelter does first." };
    const res = await generateBrandProposal(env, {
      orgId: user.org_id,
      name: str("name") || "our shelter",
      about,
      vibe: vibe || "warm and hopeful",
    });
    if (res.error || !res.brand) return { error: res.error ?? "No proposal came back." };
    await logAiWrite(env, user.org_id, user.user_id, "brand_proposal", `vibe: ${vibe.slice(0, 100)}`);
    return { ok: "Here's a proposal — apply it if you love it, tweak it if you don't.", proposal: res.brand };
  }

  if (intent === "apply-proposal") {
    try {
      const brand = validateBrand(JSON.parse(str("proposal_json")));
      await env.DB.prepare(`UPDATE orgs SET brand_json = ? WHERE id = ?`)
        .bind(JSON.stringify(brand), user.org_id)
        .run();
      return { ok: "Applied! Your whole presence just got a glow-up." };
    } catch {
      return { error: "That proposal couldn't be applied — generate a fresh one." };
    }
  }

  if (intent === "import-url") {
    const url = str("url");
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return { error: "That doesn't look like a website address." };
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "ViaTutela-BrandImport/1.0" },
      });
      if (!resp.ok) return { error: `Their site answered ${resp.status} — try the exact homepage address.` };
      const html = (await resp.text()).slice(0, 800_000);
      const scraped = scrapeHomepage(html, url);
      return {
        ok: "Here's what we found on their site — colors are prefilled below, tweak and save.",
        scraped,
      };
    } catch {
      return { error: "Couldn't reach that site (it may block robots) — you can still set everything by hand." };
    }
  }

  if (intent === "upload-logo") {
    const file = f.get("logo");
    if (!(file instanceof File) || file.size === 0) return { error: "Pick an image first." };
    if (file.size > 5 * 1024 * 1024) return { error: "Logos need to be under 5MB." };
    const type = file.type || "image/png";
    if (!type.startsWith("image/")) return { error: "That doesn't look like an image." };
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("svg") ? "svg" : "jpg";
    const key = `orgs/${user.org_id}/site/logo-${newId("m")}.${ext}`;
    await env.MEDIA.put(key, file, { httpMetadata: { contentType: type } });
    await env.DB.prepare(`INSERT INTO media (id, org_id, r2_key, alt) VALUES (?, ?, ?, ?)`)
      .bind(newId("md"), user.org_id, key, "logo")
      .run();
    // point the brand at it (kind stays whatever staff chooses on save)
    const org = await env.DB.prepare(`SELECT brand_json FROM orgs WHERE id = ?`).bind(user.org_id).first<{ brand_json: string | null }>();
    const brand = parseBrandJson(org?.brand_json ?? null);
    brand.logo = { kind: "image", imageUrl: `/api/media/${key}` };
    await env.DB.prepare(`UPDATE orgs SET brand_json = ? WHERE id = ?`).bind(JSON.stringify(brand), user.org_id).run();
    return { ok: "Logo uploaded and set." };
  }

  return null;
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";
const labelCls = "block text-sm font-semibold";

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <label className={labelCls}>
      {name}
      <span className="mt-1 flex items-center gap-2">
        <input type="color" name={name.toLowerCase()} defaultValue={value} className="h-9 w-14 rounded-lg border-2 border-cream cursor-pointer" />
        <code className="text-xs text-charcoal-soft">{value}</code>
      </span>
    </label>
  );
}

export default function BrandStudio({ loaderData, actionData }: Route.ComponentProps) {
  const { orgName, brand, media, aiReady } = loaderData;
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const a = actionData as { ok?: string; error?: string; proposal?: Brand; scraped?: { name: string | null; logoUrl: string | null; colors: string[] } } | undefined;
  const shown = a?.proposal ?? brand;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Brand Studio</h1>
          <p className="text-sm text-charcoal-soft">
            Set your identity once — your website, emails, and social templates all render from it.
          </p>
        </div>
        <Link to="/app/brand/guidelines" className="rounded-full border-2 border-meadow px-4 py-2 text-sm font-display font-semibold text-meadow-deep hover:bg-meadow hover:text-white transition-colors">
          Guidelines & social kit →
        </Link>
      </div>

      {(a?.ok || a?.error) && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${a.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {a.error ?? a.ok}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* AI brand-in-a-box + import */}
        <div className="space-y-6">
          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-xl">✨ Brand-in-a-box</h2>
            {!aiReady ? (
              <p className="mt-2 text-sm text-charcoal-soft">Needs the ANTHROPIC_API_KEY secret — then three answers become a full identity proposal.</p>
            ) : (
              <Form method="post" className="mt-3 space-y-3">
                <input type="hidden" name="intent" value="ai-propose" />
                <label className={labelCls}>
                  Shelter name
                  <input name="name" defaultValue={orgName} className={`${inputCls} w-full mt-1`} />
                </label>
                <label className={labelCls}>
                  What you do & who you serve
                  <textarea name="about" rows={2} required placeholder="Small foster-based cat rescue in Boise; seniors and special-needs a specialty" className={`${inputCls} w-full mt-1`} />
                </label>
                <label className={labelCls}>
                  The vibe
                  <input name="vibe" placeholder="cozy, hopeful, a little playful" className={`${inputCls} w-full mt-1`} />
                </label>
                <button disabled={busy} className="rounded-full bg-sky text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
                  {busy ? "Designing…" : "Propose my brand"}
                </button>
              </Form>
            )}
            {a?.proposal && (
              <Form method="post" className="mt-4 rounded-2xl border-2 border-sky/40 bg-sky/5 p-4">
                <input type="hidden" name="intent" value="apply-proposal" />
                <input type="hidden" name="proposal_json" value={JSON.stringify(a.proposal)} />
                <div className="flex gap-2">
                  {(["primary", "accent", "ink", "bg"] as const).map((k) => (
                    <span key={k} title={`${k} ${a.proposal!.palette[k]}`} className="w-9 h-9 rounded-full border-2 border-white shadow-soft" style={{ background: a.proposal!.palette[k] }} />
                  ))}
                </div>
                <p className="mt-2 text-2xl" style={wordmarkStyle(a.proposal)}>{wordmarkText(orgName, a.proposal)}</p>
                <p className="text-sm italic mt-1">"{a.proposal.tagline}"</p>
                <p className="text-xs text-charcoal-soft mt-1">{a.proposal.voice}</p>
                <button className="mt-3 rounded-full bg-meadow text-white px-5 py-2 text-sm font-display font-semibold shadow-soft">
                  Apply this brand
                </button>
              </Form>
            )}
          </section>

          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-xl">Import from your old website</h2>
            <Form method="post" className="mt-3 flex gap-2">
              <input type="hidden" name="intent" value="import-url" />
              <input name="url" type="url" required placeholder="https://your-old-site.org" className={`${inputCls} flex-1`} />
              <button disabled={busy} className="rounded-full bg-sunflower px-4 py-2 text-sm font-semibold shadow-soft disabled:opacity-50">Fetch</button>
            </Form>
            {a?.scraped && (
              <div className="mt-3 text-sm space-y-1.5">
                {a.scraped.name && <p>Name found: <strong>{a.scraped.name}</strong></p>}
                {a.scraped.logoUrl && (
                  <p className="flex items-center gap-2">
                    Possible logo: <img src={a.scraped.logoUrl} alt="found logo" className="h-8 rounded" /> <span className="text-xs text-charcoal-soft">(save it, then upload below)</span>
                  </p>
                )}
                {a.scraped.colors.length > 0 && (
                  <p className="flex items-center gap-2">
                    Colors found:{" "}
                    {a.scraped.colors.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full border" style={{ background: c }} />
                        <code className="text-xs">{c}</code>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-xl">Logo image</h2>
            <p className="text-xs text-charcoal-soft mt-1">No logo file? Skip this — the typeset wordmark looks great everywhere and never breaks in emails.</p>
            <Form method="post" encType="multipart/form-data" className="mt-3 flex gap-2 items-center">
              <input type="hidden" name="intent" value="upload-logo" />
              <input type="file" name="logo" accept="image/*" required className="text-sm flex-1 w-0" />
              <button disabled={busy} className="rounded-full bg-sunflower px-4 py-2 text-sm font-semibold shadow-soft disabled:opacity-50">Upload</button>
            </Form>
            {brand.logo.imageUrl && (
              <p className="mt-3 flex items-center gap-3 text-sm">
                Current: <img src={brand.logo.imageUrl} alt="current logo" className="h-10 rounded" />
              </p>
            )}
          </section>
        </div>

        {/* the brand form */}
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-xl">Your brand</h2>
          <Form method="post" className="mt-4 space-y-4">
            <input type="hidden" name="intent" value="save" />
            <div>
              <h3 className="font-semibold text-sm text-charcoal-soft uppercase tracking-wide">Palette</h3>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Swatch name="Primary" value={shown.palette.primary} />
                <Swatch name="Accent" value={shown.palette.accent} />
                <Swatch name="Ink" value={shown.palette.ink} />
                <Swatch name="Bg" value={shown.palette.bg} />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-charcoal-soft uppercase tracking-wide">Logo</h3>
              <div className="mt-2 flex gap-4 text-sm font-semibold">
                <label><input type="radio" name="logo_kind" value="wordmark" defaultChecked={shown.logo.kind === "wordmark"} /> Typeset wordmark</label>
                <label><input type="radio" name="logo_kind" value="image" defaultChecked={shown.logo.kind === "image"} /> Uploaded image</label>
              </div>
              <input type="hidden" name="logo_image_url" value={brand.logo.imageUrl ?? ""} />
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className={labelCls}>
                  Font
                  <select name="wm_font" defaultValue={shown.wordmark.font} className={`${inputCls} w-full mt-1`}>
                    {Object.entries(WORDMARK_FONTS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  Case
                  <select name="wm_case" defaultValue={shown.wordmark.case} className={`${inputCls} w-full mt-1`}>
                    <option value="title">Title Case</option>
                    <option value="upper">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                  </select>
                </label>
                <label className={labelCls}>
                  Tracking
                  <input name="wm_tracking" type="number" min={-50} max={300} defaultValue={shown.wordmark.tracking} className={`${inputCls} w-full mt-1`} />
                </label>
                <label className={labelCls}>
                  Weight
                  <input name="wm_weight" type="number" min={400} max={800} step={100} defaultValue={shown.wordmark.weight} className={`${inputCls} w-full mt-1`} />
                </label>
              </div>
              <p className="mt-3 rounded-2xl bg-cream p-4 text-3xl text-center" style={wordmarkStyle(shown)}>
                {wordmarkText(orgName, shown)}
              </p>
            </div>

            <label className={labelCls}>
              Typography pairing
              <select name="typography" defaultValue={shown.typography} className={`${inputCls} w-full mt-1`}>
                {Object.entries(FONT_PAIRS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>

            <div>
              <h3 className="font-semibold text-sm text-charcoal-soft uppercase tracking-wide">Site theme — the whole design language</h3>
              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                {Object.entries(SITE_THEMES).map(([k, t]) => (
                  <label
                    key={k}
                    className="flex gap-2.5 items-start rounded-2xl border-2 border-cream p-3 cursor-pointer hover:border-meadow has-[:checked]:border-meadow has-[:checked]:bg-meadow/5"
                  >
                    <input type="radio" name="theme" value={k} defaultChecked={shown.theme === k} className="mt-1 accent-[#2e7d54]" />
                    <span className="min-w-0">
                      {/* mini style swatch built from the theme's own tokens */}
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-9 h-6 border"
                          style={{
                            borderRadius: `calc(${t.radius} / 3.5)`,
                            boxShadow: t.cardShadow.replace(/6px 6px/, "2px 2px").replace(/0 6px 24px/, "0 2px 8px"),
                            background: "#fff",
                            borderColor: "#eee2d0",
                          }}
                        />
                        <span className="font-semibold text-sm">{t.label}</span>
                      </span>
                      <span className="block text-xs text-charcoal-soft mt-0.5">{t.blurb}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className={labelCls}>
              Tagline
              <input name="tagline" defaultValue={shown.tagline} maxLength={200} className={`${inputCls} w-full mt-1`} />
            </label>

            <label className={labelCls}>
              Voice — how you sound in writing (powers all AI copy)
              <textarea name="voice" rows={2} maxLength={500} defaultValue={shown.voice} className={`${inputCls} w-full mt-1`} />
            </label>

            <button disabled={busy} className="rounded-full bg-meadow text-white px-6 py-2.5 font-display font-semibold shadow-soft disabled:opacity-50">
              Save brand
            </button>
          </Form>
        </section>
      </div>

      {media.length > 0 && (
        <p className="text-xs text-charcoal-soft">
          Media library has {media.length} file{media.length === 1 ? "" : "s"} — manage them in{" "}
          <Link to="/app/website/media" className="font-semibold text-meadow-deep hover:underline">Website → Media</Link>.
        </p>
      )}
    </div>
  );
}
