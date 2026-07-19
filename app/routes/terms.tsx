import type { Route } from "./+types/terms";
import { SiteHeader, SiteFooter } from "../components/site";
import { marketingMeta } from "../lib/seo";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "Terms of Service — Tutela",
    description: "Fair, readable terms: your data is yours, pricing is plain, and you can leave anytime.",
    path: "/terms",
  });
}

const SECTIONS: { h: string; ps: string[] }[] = [
  {
    h: "The agreement",
    ps: [
      "By creating an account you agree to these terms on behalf of your organization. Tutela is a platform for animal shelters, rescues, and foster networks to manage animals, adoptions, supporters, and their public presence.",
    ],
  },
  {
    h: "Your data is yours",
    ps: [
      "Everything your organization enters remains yours. You can export all of it at any time from Settings, and you can leave whenever you like. We claim no license over your content beyond what's needed to run the service (storing it, serving your public pages, processing the features you trigger).",
    ],
  },
  {
    h: "Pricing",
    ps: [
      "The Starter plan is $9 per month plus $1 for each adoption you record; larger plans are flat monthly prices as listed on our pricing page. The migration importer is free with no account required. Per-adoption charges are counted once per animal per adoption — corrections and re-records of the same adoption are never double-billed. We'll always email you before any price change takes effect, at least 30 days ahead.",
    ],
  },
  {
    h: "Acceptable use",
    ps: [
      "Use it for animal welfare work. Don't use the platform to send spam, host unrelated content, harass anyone, misrepresent animals' health to adopters, or break the law. We may suspend accounts that do, with notice when it's safe to give one.",
    ],
  },
  {
    h: "AI features",
    ps: [
      "AI features draft; humans decide. You're responsible for reviewing AI-drafted content before publishing it, and for the accuracy of what your organization publishes. AI features have fair-use limits by plan and degrade gracefully when providers are unavailable.",
    ],
  },
  {
    h: "Availability and liability",
    ps: [
      "We run on Cloudflare's global network and aim for the service to always be up, but it's provided as-is, without warranty. To the maximum extent permitted by law, our total liability is capped at the fees you paid us in the twelve months before a claim. Nothing in these terms limits liability that can't legally be limited.",
    ],
  },
  {
    h: "Ending things",
    ps: [
      "You can close your account any time — export first, then email us and we'll delete your organization's data within 30 days. We can end service for breach of these terms, and if we ever wind the product down we'll give at least 90 days' notice with full export tools working the entire time.",
    ],
  },
  {
    h: "Questions",
    ps: ["Write to hello@viatutela.com. These terms were last updated July 2026; meaningful changes get emailed to every account 30 days before they apply."],
  },
];

export default function Terms() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-4xl font-display font-semibold">Terms, kindly.</h1>
        <p className="mt-3 text-lg text-charcoal-soft">
          Fair terms you can actually read. Last updated July 2026.
        </p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-display font-semibold">{s.h}</h2>
              {s.ps.map((p) => (
                <p key={p.slice(0, 40)} className="mt-2 text-charcoal-soft leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
