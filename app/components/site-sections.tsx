/**
 * Public renderer for the block CMS: a stack of typed sections.
 * Dynamic sections (adoptable_grid) receive live data resolved by the
 * page loader keyed by section index.
 */

import { Form } from "react-router";
import type { Section } from "../../workers/lib/site-sections";
import { Markdown } from "./markdown";
import { CatDoodle, DogDoodle, PawDoodle } from "./doodles";

export interface LiveAnimal {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  status: string;
  photo_key: string | null;
}

export interface SiteContext {
  orgSlug: string;
  accent: string; // brand accent hex
  /** live animals per section index (adoptable_grid) */
  liveAnimals: Record<number, LiveAnimal[]>;
  newsletterState?: { ok?: boolean };
}

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const items = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => typeof x === "object" && x) as Record<string, unknown>[]) : [];

function SectionShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <section className={`mx-auto ${wide ? "max-w-6xl" : "max-w-3xl"} px-4 sm:px-6 py-10`}>{children}</section>;
}

export function RenderSections({ sections, ctx }: { sections: Section[]; ctx: SiteContext }) {
  return (
    <>
      {sections.map((section, i) => (
        <RenderSection key={i} section={section} index={i} ctx={ctx} />
      ))}
    </>
  );
}

function RenderSection({ section, index, ctx }: { section: Section; index: number; ctx: SiteContext }) {
  switch (section.type) {
    case "home_hero":
      return (
        <section className="relative overflow-hidden" style={{ background: `${ctx.accent}18` }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 grid md:grid-cols-2 gap-10 items-center">
            <div>
              {s(section.eyebrow) && (
                <p className="font-semibold tracking-wide text-sm uppercase" style={{ color: ctx.accent }}>
                  {s(section.eyebrow)}
                </p>
              )}
              <h1 className="mt-2 text-4xl sm:text-5xl font-display font-semibold leading-tight">
                {s(section.heading) || "Welcome"}
              </h1>
              {s(section.sub) && <p className="mt-4 text-xl text-charcoal-soft">{s(section.sub)}</p>}
              {s(section.cta_label) && (
                <a
                  href={s(section.cta_href) || "#"}
                  className="inline-block mt-7 rounded-full px-7 py-3.5 font-display font-semibold text-lg text-white shadow-soft hover:shadow-lift transition-shadow"
                  style={{ background: ctx.accent }}
                >
                  {s(section.cta_label)}
                </a>
              )}
            </div>
            {s(section.image_url) && (
              <img src={s(section.image_url)} alt="" className="rounded-blob shadow-lift w-full object-cover max-h-96" />
            )}
          </div>
        </section>
      );

    case "hero":
      return (
        <section className="mx-auto max-w-4xl px-4 sm:px-6 pt-14 pb-4 text-center">
          <h1 className="text-3xl sm:text-5xl font-display font-semibold">{s(section.heading)}</h1>
          {s(section.sub) && <p className="mt-4 text-lg text-charcoal-soft">{s(section.sub)}</p>}
          {s(section.image_url) && (
            <img src={s(section.image_url)} alt="" className="mt-8 rounded-blob shadow-soft w-full object-cover max-h-80" />
          )}
        </section>
      );

    case "prose":
      return (
        <SectionShell>
          <Markdown text={s(section.md)} className="text-lg" />
        </SectionShell>
      );

    case "image_text": {
      const side = s(section.image_side) === "right" ? "md:order-last" : "";
      return (
        <SectionShell wide>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {s(section.image_url) && (
              <img src={s(section.image_url)} alt={s(section.alt)} className={`rounded-blob shadow-soft w-full object-cover max-h-96 ${side}`} />
            )}
            <div>
              {s(section.heading) && <h2 className="text-2xl sm:text-3xl font-display font-semibold">{s(section.heading)}</h2>}
              <Markdown text={s(section.md)} className="mt-4 text-lg" />
            </div>
          </div>
        </SectionShell>
      );
    }

    case "adoptable_grid": {
      const animals = ctx.liveAnimals[index] ?? [];
      return (
        <SectionShell wide>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-center">
            {s(section.heading) || "Looking for a home"}
          </h2>
          {animals.length === 0 ? (
            <p className="mt-6 text-center text-charcoal-soft">
              No friends waiting right now — check back soon.
            </p>
          ) : (
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {animals.map((a) => {
                const Doodle = a.species === "cat" ? CatDoodle : a.species === "dog" ? DogDoodle : PawDoodle;
                return (
                  <a
                    key={a.id}
                    href={`/adopt/${ctx.orgSlug}/${a.id}`}
                    className="rounded-blob bg-white shadow-soft overflow-hidden hover:shadow-lift transition-shadow"
                  >
                    {a.photo_key ? (
                      <img src={`/api/media/${a.photo_key}`} alt={a.name} className="w-full h-44 object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-44 bg-cream flex items-center justify-center">
                        <Doodle className="w-20 h-20 text-charcoal-soft" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-display font-semibold text-lg">{a.name}</h3>
                      <p className="text-sm text-charcoal-soft">{[a.breed ?? a.species].filter(Boolean).join("")}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
          <p className="mt-6 text-center">
            <a href={`/adopt/${ctx.orgSlug}`} className="font-display font-semibold underline decoration-2 underline-offset-4" style={{ color: ctx.accent }}>
              See everyone →
            </a>
          </p>
        </SectionShell>
      );
    }

    case "success_stories":
      return (
        <SectionShell wide>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-center">
            {s(section.heading) || "Gone home"}
          </h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items(section.items).map((it, i) => (
              <div key={i} className="rounded-blob bg-white shadow-soft overflow-hidden">
                {s(it.image_url) && <img src={s(it.image_url)} alt="" className="w-full h-44 object-cover" loading="lazy" />}
                <div className="p-5">
                  <h3 className="font-display font-semibold">{s(it.title)}</h3>
                  <p className="mt-1 text-sm text-charcoal-soft">{s(it.text)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      );

    case "gallery":
      return (
        <SectionShell wide>
          {s(section.heading) && (
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-center mb-8">{s(section.heading)}</h2>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items(section.items).map((it, i) => (
              <img key={i} src={s(it.image_url)} alt={s(it.alt)} className="w-full aspect-square object-cover rounded-2xl shadow-soft" loading="lazy" />
            ))}
          </div>
        </SectionShell>
      );

    case "quote":
      return (
        <SectionShell>
          <blockquote className="text-center">
            <p className="text-2xl font-display leading-relaxed">“{s(section.text)}”</p>
            {s(section.attribution) && <footer className="mt-3 font-semibold text-charcoal-soft">— {s(section.attribution)}</footer>}
          </blockquote>
        </SectionShell>
      );

    case "faq":
      return (
        <SectionShell>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-center">
            {s(section.heading) || "Good questions"}
          </h2>
          <div className="mt-6 space-y-3">
            {items(section.items).map((it, i) => (
              <details key={i} className="rounded-2xl bg-white shadow-soft p-5">
                <summary className="font-display font-semibold cursor-pointer">{s(it.q)}</summary>
                <Markdown text={s(it.a)} className="mt-2 text-charcoal-soft" />
              </details>
            ))}
          </div>
        </SectionShell>
      );

    case "cta_band":
      return (
        <section className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
          <div className="rounded-blob text-white shadow-lift p-10 text-center" style={{ background: ctx.accent }}>
            <h2 className="text-3xl font-display font-semibold">{s(section.heading) || "Lend a paw"}</h2>
            {s(section.text) && <p className="mt-3 text-lg text-white/90">{s(section.text)}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {s(section.primary_label) && (
                <a href={s(section.primary_href) || "#"} className="rounded-full bg-white px-6 py-3 font-display font-semibold text-charcoal shadow-soft">
                  {s(section.primary_label)}
                </a>
              )}
              {s(section.secondary_label) && (
                <a href={s(section.secondary_href) || "#"} className="rounded-full border-2 border-white/80 px-6 py-3 font-display font-semibold text-white">
                  {s(section.secondary_label)}
                </a>
              )}
            </div>
          </div>
        </section>
      );

    case "events_strip":
      return (
        <SectionShell wide>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-center">
            {s(section.heading) || "Come say hello"}
          </h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items(section.items).map((it, i) => (
              <div key={i} className="rounded-blob bg-white shadow-soft p-5">
                <p className="text-sm font-bold" style={{ color: ctx.accent }}>{s(it.date)}</p>
                <h3 className="mt-1 font-display font-semibold text-lg">{s(it.title)}</h3>
                {s(it.place) && <p className="text-sm text-charcoal-soft">{s(it.place)}</p>}
                {s(it.text) && <p className="mt-2 text-sm">{s(it.text)}</p>}
              </div>
            ))}
          </div>
        </SectionShell>
      );

    case "newsletter_signup":
      return (
        <SectionShell>
          <div className="rounded-blob bg-white shadow-soft p-8 text-center">
            <h2 className="text-2xl font-display font-semibold">{s(section.heading) || "Stay close to the pack"}</h2>
            {s(section.text) && <p className="mt-2 text-charcoal-soft">{s(section.text)}</p>}
            {ctx.newsletterState?.ok ? (
              <p className="mt-4 font-semibold" style={{ color: ctx.accent }}>
                Welcome aboard — you're on the list. 🐾
              </p>
            ) : (
              <Form method="post" className="mt-5 flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                <input type="hidden" name="intent" value="newsletter" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.org"
                  className="flex-1 rounded-full border-2 border-cream bg-cream px-5 py-2.5 focus:outline-none"
                />
                <button className="rounded-full px-6 py-2.5 font-display font-semibold text-white shadow-soft" style={{ background: ctx.accent }}>
                  Sign up
                </button>
              </Form>
            )}
          </div>
        </SectionShell>
      );

    default:
      return null;
  }
}
