import { Link } from "react-router";
import type { Route } from "./+types/guides.states";
import { SiteHeader, SiteFooter } from "../components/site";
import { marketingMeta } from "../lib/seo";
import { STATES, REGION_NOTES, type Region } from "../lib/guide-states";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "How to Start an Animal Rescue in Your State (50-State Guide)",
    description:
      "State-by-state guides to starting an animal rescue: incorporation, 501(c)(3), state licensing and registration requirements, and regional rescue realities.",
    path: "/guides/start-a-rescue",
  });
}

const REGIONS = Object.keys(REGION_NOTES) as Region[];

export default function StateIndex() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
        <nav className="text-sm font-semibold text-charcoal-soft">
          <Link to="/guides" className="hover:text-charcoal">← All guides</Link>
        </nav>
        <h1 className="mt-6 text-3xl sm:text-5xl font-display font-semibold leading-tight">
          Start a rescue in your state
        </h1>
        <p className="mt-4 text-lg text-charcoal-soft max-w-2xl">
          The legal spine of starting a rescue is federal, but the licensing, the intake
          pressure, and the rescue ecosystem are local. Pick your state for the specifics —
          or start with the{" "}
          <Link to="/guides/starting-an-animal-rescue" className="font-semibold text-meadow-deep hover:underline">
            universal checklist
          </Link>
          .
        </p>
        {REGIONS.map((region) => {
          const states = STATES.filter((s) => s.region === region);
          if (!states.length) return null;
          return (
            <section key={region} className="mt-10">
              <h2 className="text-xl font-display font-semibold">{region}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {states.map((s) => (
                  <Link
                    key={s.slug}
                    to={`/guides/start-a-rescue/${s.slug}`}
                    className="rounded-full bg-white shadow-soft px-4 py-2 text-sm font-semibold hover:shadow-lift transition-shadow"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <SiteFooter />
    </div>
  );
}
