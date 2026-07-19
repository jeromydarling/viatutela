import { Link } from "react-router";
import type { Route } from "./+types/guides.state";
import { SiteHeader, SiteFooter } from "../components/site";
import { marketingMeta, SITE_ORIGIN } from "../lib/seo";
import { getState, nearbyStates, REGION_NOTES, type RescueState } from "../lib/guide-states";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.state) return [{ title: "Guide not found — Tutela" }];
  const s = loaderData.state;
  return marketingMeta({
    title: `How to Start an Animal Rescue in ${s.name} (2026)`,
    description: `Starting an animal rescue in ${s.name}: nonprofit incorporation, 501(c)(3), ${s.name} licensing and registration, vet partnerships, and regional rescue realities.`,
    path: `/guides/start-a-rescue/${s.slug}`,
  });
}

export async function loader({ params }: Route.LoaderArgs) {
  const state = getState(params.state);
  if (!state) throw new Response("Not found", { status: 404 });
  return { state, nearby: nearbyStates(state) };
}

function stateJsonLd(s: RescueState): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: `How to start an animal rescue in ${s.name}`,
        description: `Nonprofit setup, state requirements, and regional rescue context for founding an animal rescue in ${s.name}.`,
        dateModified: "2026-07-19",
        url: `${SITE_ORIGIN}/guides/start-a-rescue/${s.slug}`,
        author: { "@type": "Organization", name: "Tutela", url: SITE_ORIGIN },
        publisher: { "@type": "Organization", name: "Tutela", url: SITE_ORIGIN },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Guides", item: `${SITE_ORIGIN}/guides` },
          { "@type": "ListItem", position: 2, name: "Start a rescue", item: `${SITE_ORIGIN}/guides/start-a-rescue` },
          { "@type": "ListItem", position: 3, name: s.name, item: `${SITE_ORIGIN}/guides/start-a-rescue/${s.slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `Do I need a license to run an animal rescue in ${s.name}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: s.licensing ?? `${s.name} requirements vary by county and city, and some activities (importing animals, housing above certain counts) trigger state rules. Confirm with the ${s.name} Department of Agriculture and your county animal control before taking animals into care.`,
            },
          },
          {
            "@type": "Question",
            name: `How do I make my ${s.name} rescue a 501(c)(3)?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Incorporate as a nonprofit with the ${s.corp}, then file IRS Form 1023-EZ (most small rescues qualify) for federal tax exemption. Grants and tax-deductible donations both depend on it.`,
            },
          },
        ],
      },
    ],
  });
}

export default function StateGuide({ loaderData }: Route.ComponentProps) {
  const { state: s, nearby } = loaderData;
  const region = REGION_NOTES[s.region];
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stateJsonLd(s) }} />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
        <nav className="text-sm font-semibold text-charcoal-soft flex gap-2">
          <Link to="/guides" className="hover:text-charcoal">Guides</Link>
          <span aria-hidden>/</span>
          <Link to="/guides/start-a-rescue" className="hover:text-charcoal">Start a rescue</Link>
        </nav>
        <p className="mt-6 font-display font-semibold text-meadow-deep uppercase tracking-wide text-sm">
          {s.region} · Founder's guide
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-display font-semibold leading-tight">
          How to start an animal rescue in {s.name}
        </h1>
        <p className="mt-4 text-lg text-charcoal-soft">
          The paperwork, the partnerships, and the {s.region}-specific realities — everything the
          first year asks of a {s.name} rescue founder.
        </p>

        <article className="mt-10 space-y-5 text-lg leading-relaxed">
          <p>{region.context}</p>

          <h2 className="pt-4 text-2xl font-display font-semibold">The legal spine in {s.name}</h2>
          <p>
            Incorporate as a nonprofit with the <strong>{s.corp}</strong>, then file IRS Form 1023
            (or the 1023-EZ, which most small rescues qualify for) to get your 501(c)(3) — grants
            and tax-deductible donations both depend on it. Adopt bylaws, seat a real board of at
            least three, and open the bank account in the organization's name in month one.
          </p>
          {s.licensing ? (
            <aside className="rounded-2xl bg-sunflower-soft px-5 py-4 font-semibold leading-relaxed text-base">
              🏛️ <strong>{s.name} specifics:</strong> {s.licensing} Rules change — confirm current
              requirements with the agency before your first intake.
            </aside>
          ) : (
            <aside className="rounded-2xl bg-sunflower-soft px-5 py-4 font-semibold leading-relaxed text-base">
              🏛️ <strong>{s.name} specifics:</strong> We're not aware of a statewide rescue
              license in {s.name}, but county and city rules apply everywhere, and activities like
              importing animals or housing above certain counts can trigger state requirements.
              Ask the {s.name} Department of Agriculture and your county animal control before
              your first intake — a thirty-minute call now beats a compliance letter later.
            </aside>
          )}

          <h2 className="pt-4 text-2xl font-display font-semibold">
            Rescue reality in your part of the country
          </h2>
          <p>{region.practical}</p>

          <h2 className="pt-4 text-2xl font-display font-semibold">The universal essentials</h2>
          <p>
            Beyond {s.name}'s specifics, every new rescue stands on the same four legs — each one
            covered in depth in our{" "}
            <Link to="/guides/starting-an-animal-rescue" className="font-semibold text-meadow-deep hover:underline">
              full founding checklist
            </Link>
            :
          </p>
          <ul className="space-y-2 pl-1 text-lg">
            {[
              "A committed vet partner with rescue rates and an emergency protocol — before your first intake",
              "Written intake criteria and a capacity cap you obey on the hard days",
              "A foster network you recruit before you're desperate and support like the treasure it is",
              "Real record-keeping from day one — animals, medical, adopters, and donations in one system, not in texts and memory",
            ].map((li) => (
              <li key={li.slice(0, 30)} className="flex gap-2.5">
                <span aria-hidden className="text-meadow-deep font-bold">✓</span>
                <span>{li}</span>
              </li>
            ))}
          </ul>
          <p>
            On that last leg: spreadsheets crack faster than founders expect (here's{" "}
            <Link to="/guides/spreadsheets-vs-shelter-software" className="font-semibold text-meadow-deep hover:underline">
              exactly where
            </Link>
            ). Tutela's Starter plan is $9 a month plus $1 per adoption precisely so a
            brand-new {s.name} rescue can afford real systems from intake #1 — adoption pages,
            medical reminders, donation receipts, and a website included.
          </p>
        </article>

        <div className="mt-12 rounded-blob bg-meadow-deep text-white p-8 text-center">
          <p className="font-display font-semibold text-xl">
            Give your {s.name} rescue a real system from day one.
          </p>
          <Link
            to="/signup"
            className="mt-4 inline-block rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow"
          >
            Get started — $9/month + $1 per adoption
          </Link>
        </div>

        {nearby.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-display font-semibold">Nearby states</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {nearby.map((n) => (
                <Link
                  key={n.slug}
                  to={`/guides/start-a-rescue/${n.slug}`}
                  className="rounded-full bg-white shadow-soft px-4 py-2 text-sm font-semibold hover:shadow-lift transition-shadow"
                >
                  {n.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-10 text-xs text-charcoal-soft">
          Last updated 2026-07-19. Licensing and filing requirements change — always confirm
          current rules with the named agencies. This guide is practical orientation, not legal
          advice.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
