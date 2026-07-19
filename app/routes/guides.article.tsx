import { Link } from "react-router";
import type { Route } from "./+types/guides.article";
import { SiteHeader, SiteFooter } from "../components/site";
import { marketingMeta, SITE_ORIGIN } from "../lib/seo";
import { getGuide, relatedGuides, type Guide } from "../lib/guides";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.guide) return [{ title: "Guide not found — Tutela" }];
  return marketingMeta({
    title: loaderData.guide.title,
    description: loaderData.guide.description,
    path: `/guides/${loaderData.guide.slug}`,
  });
}

export async function loader({ params }: Route.LoaderArgs) {
  const guide = getGuide(params.slug);
  if (!guide) throw new Response("Not found", { status: 404 });
  return { guide, related: relatedGuides(guide) };
}

function guideJsonLd(guide: Guide): string {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: guide.h1,
      description: guide.description,
      dateModified: guide.updated,
      url: `${SITE_ORIGIN}/guides/${guide.slug}`,
      author: { "@type": "Organization", name: "Tutela", url: SITE_ORIGIN },
      publisher: { "@type": "Organization", name: "Tutela", url: SITE_ORIGIN },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Guides", item: `${SITE_ORIGIN}/guides` },
        { "@type": "ListItem", position: 2, name: guide.h1, item: `${SITE_ORIGIN}/guides/${guide.slug}` },
      ],
    },
  ];
  if (guide.faq?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: guide.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

/** Render a paragraph, turning [text](/path) into internal links. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!m) return <span key={i}>{part}</span>;
        return (
          <Link key={i} to={m[2]} className="font-semibold text-meadow-deep hover:underline">
            {m[1]}
          </Link>
        );
      })}
    </>
  );
}

export default function GuideArticle({ loaderData }: Route.ComponentProps) {
  const { guide, related } = loaderData;
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: guideJsonLd(guide) }} />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
        <nav className="text-sm font-semibold text-charcoal-soft">
          <Link to="/guides" className="hover:text-charcoal">← All guides</Link>
        </nav>
        <p className="mt-6 font-display font-semibold text-meadow-deep uppercase tracking-wide text-sm">
          {guide.category} · {guide.minutes} min read
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-display font-semibold leading-tight">
          {guide.h1}
        </h1>
        <p className="mt-4 text-lg text-charcoal-soft">{guide.description}</p>

        <article className="mt-10 space-y-5">
          {guide.blocks.map((b, i) => {
            if (b.h2) {
              return (
                <h2 key={i} className="pt-4 text-2xl font-display font-semibold">
                  {b.h2}
                </h2>
              );
            }
            if (b.list) {
              return (
                <ul key={i} className="space-y-2 pl-1">
                  {b.list.map((li) => (
                    <li key={li.slice(0, 40)} className="flex gap-2.5 leading-relaxed">
                      <span aria-hidden className="text-meadow-deep font-bold">✓</span>
                      <span><Inline text={li} /></span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (b.tip) {
              return (
                <aside key={i} className="rounded-2xl bg-sunflower-soft px-5 py-4 font-semibold leading-relaxed">
                  🌻 <Inline text={b.tip} />
                </aside>
              );
            }
            return (
              <p key={i} className="leading-relaxed text-lg">
                <Inline text={b.p ?? ""} />
              </p>
            );
          })}
        </article>

        {guide.faq && guide.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-display font-semibold">Questions we hear a lot</h2>
            <div className="mt-4 space-y-4">
              {guide.faq.map((f) => (
                <div key={f.q} className="rounded-blob bg-white shadow-soft p-6">
                  <h3 className="font-display font-semibold">{f.q}</h3>
                  <p className="mt-2 text-charcoal-soft leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 rounded-blob bg-meadow-deep text-white p-8 text-center">
          <p className="font-display font-semibold text-xl">{guide.cta.text}</p>
          <Link
            to={guide.cta.to}
            className="mt-4 inline-block rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow"
          >
            {guide.cta.label}
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-display font-semibold">Keep reading</h2>
            <div className="mt-4 grid sm:grid-cols-3 gap-4">
              {related.map((g) => (
                <Link
                  key={g.slug}
                  to={`/guides/${g.slug}`}
                  className="rounded-2xl bg-white shadow-soft p-4 hover:shadow-lift transition-shadow"
                >
                  <p className="font-display font-semibold text-sm leading-snug">{g.h1}</p>
                  <p className="mt-2 text-xs font-semibold text-meadow-deep">{g.minutes} min →</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-10 text-xs text-charcoal-soft">
          Last updated {guide.updated}. Comparison details reference published information as of
          mid-2026 — always verify current pricing with each vendor.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
