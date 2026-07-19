import { Link } from "react-router";
import type { Route } from "./+types/guides";
import { SiteHeader, SiteFooter } from "../components/site";
import { marketingMeta } from "../lib/seo";
import { GUIDES, GUIDE_CATEGORIES } from "../lib/guides";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "Shelter Guides — Tutela",
    description:
      "Practical playbooks for animal shelters and rescues: adoptions, photos, social media, grants, software migrations, and honest tool comparisons.",
    path: "/guides",
  });
}

export default function Guides() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-display font-semibold leading-tight">
            Guides for the people doing the work
          </h1>
          <p className="mt-4 text-lg text-charcoal-soft">
            Practical, honest playbooks from the trenches of animal rescue — no fluff, no
            gatekeeping, no email wall. Take what helps.
          </p>
        </div>

        {GUIDE_CATEGORIES.map((cat) => {
          const guides = GUIDES.filter((g) => g.category === cat.key);
          if (!guides.length) return null;
          return (
            <section key={cat.key} className="mt-14">
              <h2 className="text-2xl font-display font-semibold">{cat.label}</h2>
              <p className="mt-1 text-charcoal-soft">{cat.blurb}</p>
              <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {guides.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/guides/${g.slug}`}
                    className="rounded-blob bg-white shadow-soft p-6 flex flex-col hover:shadow-lift transition-shadow"
                  >
                    <h3 className="font-display font-semibold text-lg leading-snug">{g.h1}</h3>
                    <p className="mt-2 text-sm text-charcoal-soft leading-relaxed flex-1">
                      {g.description}
                    </p>
                    <p className="mt-4 text-xs font-semibold text-meadow-deep">
                      {g.minutes} min read →
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mt-14 rounded-blob bg-white shadow-soft p-8">
          <h2 className="text-2xl font-display font-semibold">🗺️ Starting a rescue? We wrote your state's guide.</h2>
          <p className="mt-2 text-charcoal-soft max-w-2xl">
            Incorporation, licensing, and the regional rescue realities — one founder's guide for
            each of the 50 states.
          </p>
          <Link
            to="/guides/start-a-rescue"
            className="mt-4 inline-block rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow"
          >
            Find your state →
          </Link>
        </section>

        <div className="mt-16 rounded-blob bg-meadow-deep text-white p-8 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-display font-semibold">
            The software these guides assume you deserve
          </h2>
          <p className="mt-2 text-white/95 max-w-xl mx-auto">
            Everything above is doable by hand. Tutela just does the relentless parts for you —
            from $9 a month plus $1 per adoption.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow"
            >
              Get started
            </Link>
            <a
              href="/demo"
              className="rounded-full border-2 border-white/70 px-6 py-3 font-display font-semibold text-white hover:bg-white hover:text-meadow-deep transition-colors"
            >
              🌻 Take the live demo for a spin
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
