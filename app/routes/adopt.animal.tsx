import { Form, Link, useNavigation } from "react-router";
import QRCode from "qrcode";
import type { Route } from "./+types/adopt.animal";
import { cloudflareContext } from "../cloudflare-context";
import { getEnv } from "../lib/auth.server";
import { newId } from "../../workers/lib/ids";
import { sendAppEmail } from "../../workers/lib/email";
import { sendSms } from "../../workers/lib/sms";
import { ShareBar } from "../components/share-bar";
import { CatDoodle, DogDoodle, HeartPawDoodle, PawDoodle } from "../components/doodles";

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [];
  const title = `Meet ${data.animal.name} — ${data.org.name}`;
  const description =
    (data.animal.description ? String(data.animal.description).slice(0, 200) : null) ??
    `${data.animal.name} is looking for a home at ${data.org.name}.`;
  const out: Record<string, string>[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: data.shareUrl },
    { name: "twitter:card", content: data.ogImage ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (data.ogImage) {
    out.push({ property: "og:image", content: data.ogImage });
    out.push({ name: "twitter:image", content: data.ogImage });
  }
  return out;
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(`SELECT id, name, slug, email, phone FROM orgs WHERE slug = ?`)
    .bind(params.slug)
    .first<Record<string, string | null>>();
  if (!org) throw new Response("Not found", { status: 404 });

  const animal = await env.DB.prepare(
    `SELECT id, name, species, breed, sex, dob, altered, status, description, bonded_group_id, color, weight
     FROM animals WHERE id = ? AND org_id = ? AND is_public = 1`,
  )
    .bind(params.animalId, org.id)
    .first<Record<string, unknown>>();
  if (!animal) throw new Response("Not found", { status: 404 });

  const [media, bonded] = await Promise.all([
    env.DB.prepare(
      `SELECT r2_key, kind, caption, alt_text FROM animal_photos WHERE animal_id = ? ORDER BY kind, created_at LIMIT 16`,
    )
      .bind(animal.id)
      .all<{ r2_key: string; kind: string; caption: string | null; alt_text: string | null }>(),
    animal.bonded_group_id
      ? env.DB.prepare(
          `SELECT id, name FROM animals WHERE org_id = ? AND bonded_group_id = ? AND id != ? AND is_public = 1`,
        ).bind(org.id, animal.bonded_group_id, animal.id).all<{ id: string; name: string }>()
      : Promise.resolve({ results: [] as { id: string; name: string }[] }),
  ]);

  const url = new URL(request.url);
  const shareUrl = `${url.origin}/adopt/${org.slug}/${animal.id}`;
  const photos = media.results.filter((m) => m.kind !== "video");
  const videos = media.results.filter((m) => m.kind === "video");
  const ogImage = photos[0] ? `${url.origin}/api/media/${photos[0].r2_key}` : null;
  const qrSvg = await QRCode.toString(shareUrl, { type: "svg", margin: 1, width: 160 });

  return {
    org,
    animal,
    photos,
    videos,
    bonded: bonded.results,
    shareUrl,
    ogImage,
    qrSvg,
  };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const env = getEnv(context);
  const { ctx } = context.get(cloudflareContext);
  const org = await env.DB.prepare(`SELECT id, name, email, sms_number FROM orgs WHERE slug = ?`)
    .bind(params.slug)
    .first<{ id: string; name: string; email: string | null; sms_number: string | null }>();
  if (!org) throw new Response("Not found", { status: 404 });

  const f = await request.formData();
  // honeypot: real people leave this empty
  if (String(f.get("website") ?? "")) return { ok: true };

  const name = String(f.get("name") ?? "").trim();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: "We need your name and a real email so the rescue can reach you." };
  }
  const interest = ["adopt", "meet", "foster_to_adopt", "question"].includes(String(f.get("interest")))
    ? String(f.get("interest"))
    : "adopt";

  await env.DB.prepare(
    `INSERT INTO applications (id, org_id, animal_id, name, email, phone, home_type, message, interest)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId("ap"), org.id, params.animalId, name, email,
      String(f.get("phone") ?? "").trim() || null,
      String(f.get("home_type") ?? "").trim() || null,
      String(f.get("message") ?? "").trim().slice(0, 2000) || null,
      interest,
    )
    .run();

  const animal = await env.DB.prepare(`SELECT name FROM animals WHERE id = ?`)
    .bind(params.animalId)
    .first<{ name: string }>();
  const animalName = animal?.name ?? "one of our friends";
  const origin = new URL(request.url).origin;

  // confirmation to the applicant + heads-up to the rescue — never blocks the response
  ctx.waitUntil(
    Promise.all([
      sendAppEmail(env, {
        to: email,
        subject: `We got your application for ${animalName} 🐾`,
        heading: `Your application for ${animalName} is on its way`,
        paragraphs: [
          `Thank you for opening your home, ${name}.`,
          `${org.name} has your application and will reach out soon. Applying starts a conversation — it doesn't commit you to anything.`,
        ],
        ...(org.email ? { replyTo: org.email } : {}),
      }),
      org.email
        ? sendAppEmail(env, {
            to: org.email,
            subject: `New adoption application: ${animalName}`,
            heading: `${name} wants to meet ${animalName}`,
            paragraphs: [
              `A new application just arrived from ${name} (${email}).`,
              `Review it when you have a quiet moment — no rush, but warm hearts cool fast.`,
            ],
            cta: { label: "Review the application", url: `${origin}/app/applications` },
          })
        : Promise.resolve(false),
      org.sms_number
        ? sendSms(env, org.sms_number, `🐾 New application: ${name} wants to meet ${animalName}. Review: ${origin}/app/applications`)
        : Promise.resolve(false),
    ]),
  );

  return { ok: true };
}

function ageLabel(dob: unknown): string | null {
  if (typeof dob !== "string" || !dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!isFinite(years) || years < 0) return null;
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months old`;
  return `${Math.floor(years)} year${years >= 2 ? "s" : ""} old`;
}

const inputCls =
  "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function AdoptAnimal({ loaderData, actionData }: Route.ComponentProps) {
  const { org, animal, photos, videos, bonded, shareUrl, ogImage, qrSvg } = loaderData;
  const nav = useNavigation();
  const Doodle = animal.species === "cat" ? CatDoodle : animal.species === "dog" ? DogDoodle : PawDoodle;

  const facts = [animal.breed ?? animal.species, animal.sex, ageLabel(animal.dob)].filter(Boolean).join(", ");
  const blurb =
    `${String(animal.name)} (${facts || "a lovely friend"}) is looking for a home at ${org.name}. ` +
    (bonded.length > 0 ? `Bonded with ${bonded.map((b) => b.name).join(" & ")} — they go home together. ` : "") +
    `Can you help ${String(animal.name)} find their people?`;
  const embedSnippet = `<iframe src="${shareUrl}/embed" width="320" height="440" style="border:0;border-radius:16px;overflow:hidden" title="Adopt ${String(animal.name)}" loading="lazy"></iframe>`;

  return (
    <div>
      <header className="bg-meadow text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
          <Link to={`/adopt/${org.slug}`} className="font-semibold text-white/90 hover:text-white">
            ← All friends at {org.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10 grid lg:grid-cols-2 gap-10">
        <div>
          {photos.length > 0 ? (
            <div className="space-y-3">
              <img
                src={`/api/media/${photos[0].r2_key}`}
                alt={photos[0].alt_text ?? photos[0].caption ?? String(animal.name)}
                className="w-full rounded-blob object-cover max-h-[28rem] shadow-soft"
              />
              {(photos.length > 1 || videos.length > 0) && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.slice(1).map((p) => (
                    <a key={p.r2_key} href={`/api/media/${p.r2_key}`} target="_blank" rel="noreferrer">
                      <img
                        src={`/api/media/${p.r2_key}`}
                        alt={p.alt_text ?? p.caption ?? `${String(animal.name)} photo`}
                        className="w-full aspect-square object-cover rounded-2xl hover:opacity-90"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
              {videos.map((v) => (
                <video
                  key={v.r2_key}
                  src={`/api/media/${v.r2_key}`}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full rounded-blob shadow-soft"
                  aria-label={v.caption ?? `${String(animal.name)} video`}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-blob bg-white shadow-soft h-72 flex items-center justify-center">
              <Doodle className="w-32 h-32 text-charcoal-soft" />
            </div>
          )}

          <h1 className="mt-6 text-4xl font-display font-bold">{String(animal.name)}</h1>
          <p className="mt-1 text-lg text-charcoal-soft">
            {[animal.breed ?? animal.species, animal.sex, ageLabel(animal.dob), animal.color, animal.weight]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
            {Boolean(animal.altered) && (
              <span className="rounded-full bg-meadow/15 text-meadow-deep px-3 py-1">spayed/neutered</span>
            )}
            {animal.status !== "available" && (
              <span className="rounded-full bg-sunflower-soft px-3 py-1">
                {animal.status === "pending" ? "adoption pending" : String(animal.status)}
              </span>
            )}
          </div>
          {bonded.length > 0 && (
            <p className="mt-4 rounded-2xl bg-terracotta/10 text-terracotta-deep px-4 py-3 font-semibold">
              ♥ {String(animal.name)} is bonded with{" "}
              {bonded.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ", "}
                  <Link to={`/adopt/${org.slug}/${b.id}`} className="underline">{b.name}</Link>
                </span>
              ))}{" "}
              — they go home together.
            </p>
          )}
          {Boolean(animal.description) && (
            <p className="mt-4 text-lg leading-relaxed">{String(animal.description)}</p>
          )}

          <ShareBar
            target={{ url: shareUrl, title: `Meet ${String(animal.name)}`, blurb, imageUrl: ogImage }}
            qrSvg={qrSvg}
            embedSnippet={embedSnippet}
            shareKitHref={`/api/share-kit/${org.slug}/${animal.id}.zip`}
            flyerHref={`/adopt/${org.slug}/${animal.id}/flyer`}
          />
        </div>

        <div>
          {actionData?.ok ? (
            <div className="rounded-blob bg-white shadow-lift p-8 text-center">
              <HeartPawDoodle className="w-20 h-20 mx-auto text-meadow" />
              <h2 className="mt-4 text-2xl font-display font-semibold">
                Your application is on its way.
              </h2>
              <p className="mt-2 text-charcoal-soft">
                {org.name} will reach out soon. Thank you for opening your home.
              </p>
              <p className="mt-4 text-sm text-charcoal-soft">
                While you wait — sharing {String(animal.name)}'s page helps even more friends get found.
              </p>
            </div>
          ) : (
            <Form method="post" className="rounded-blob bg-white shadow-lift p-8 space-y-4 sticky top-8">
              <h2 className="text-2xl font-display font-semibold">
                Ask about {String(animal.name)}
              </h2>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <label className="block">
                <span className="font-semibold text-sm">I'd like to…</span>
                <select name="interest" className={inputCls}>
                  <option value="adopt">Adopt {String(animal.name)}</option>
                  <option value="meet">Meet {String(animal.name)} first</option>
                  <option value="foster_to_adopt">Try foster-to-adopt</option>
                  <option value="question">Just ask a question</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-sm">Your name *</span>
                <input name="name" required className={inputCls} />
              </label>
              <label className="block">
                <span className="font-semibold text-sm">Email *</span>
                <input name="email" type="email" required className={inputCls} />
              </label>
              <label className="block">
                <span className="font-semibold text-sm">Phone</span>
                <input name="phone" className={inputCls} />
              </label>
              <label className="block">
                <span className="font-semibold text-sm">Your home</span>
                <select name="home_type" className={inputCls}>
                  <option value="">Choose…</option>
                  <option>House with a yard</option>
                  <option>House, no yard</option>
                  <option>Apartment</option>
                  <option>Farm / rural</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-sm">
                  Tell {org.name} about your family, other pets, experience…
                </span>
                <textarea name="message" rows={4} className={inputCls} />
              </label>
              {actionData?.error && (
                <p className="font-semibold text-terracotta-deep" role="alert">{actionData.error}</p>
              )}
              <button
                disabled={nav.state !== "idle"}
                className="w-full rounded-full bg-sunflower px-6 py-3.5 font-display font-semibold text-lg shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
              >
                {nav.state !== "idle" ? "Sending…" : "Send application"}
              </button>
              <p className="text-xs text-charcoal-soft text-center">
                Applying is free and doesn't commit you — it starts a conversation. Your details go
                to {org.name} and are handled per our{" "}
                <a href="/privacy" className="underline hover:text-charcoal">privacy policy</a>.
              </p>
            </Form>
          )}
        </div>
      </main>
    </div>
  );
}
