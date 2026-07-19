import { Link } from "react-router";
import type { Route } from "./+types/home";
import { SiteHeader, SiteFooter } from "../components/site";
import { SavingsCalculator } from "../components/savings-calculator";
import {
  BirdDoodle,
  CatDoodle,
  DogDoodle,
  HeartPawDoodle,
  PawDoodle,
  WolfDoodle,
} from "../components/doodles";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Via Tutela — Every animal deserves a way home." },
    {
      name: "description",
      content:
        "The all-in-one platform for shelters, rescues, and fosters. Move in free, keep your data, keep your money.",
    },
  ];
}

const PAIN_RELIEF: { pain: string; relief: string }[] = [
  {
    pain: "“It bugs out and goes down all the time.”",
    relief: "Runs on a global edge network — fast and steady everywhere.",
  },
  {
    pain: "“Payments disappear or auto-refund; adopters never get paperwork.”",
    relief: "Reliable Stripe payments + guaranteed-delivery email/SMS.",
  },
  {
    pain: "“I walk 20 minutes to a computer just to look up one dog.”",
    relief: "Scan a kennel QR on your phone — full profile in seconds.",
  },
  {
    pain: "“Switching means re-typing everything by hand.”",
    relief: "Free importer keeps every record AND every relationship.",
  },
  {
    pain: "“Our data is locked to a microchip/insurance deal.”",
    relief: "Own your data. One-click export, anytime, no strings.",
  },
  {
    pain: "“We pay for five different tools.”",
    relief: "One platform: animals, adoptions, fosters, donors, website.",
  },
];

const COMPARE_ROWS: [string, string, string, string, string, string][] = [
  ["Pricing", "Flat $0–$79/mo", "$2 / adoption", "“Free”*", "$75–$100/yr modular", "$99–$149/mo"],
  ["Takes a cut of your fees/donations", "No", "No", "Indirect (insurance/chip)", "No", "No"],
  ["Data strings attached", "None", "None", "Microchip + insurance push", "None", "None"],
  ["One-click full data export", "Yes", "Partial", "Limited", "Partial", "Partial"],
  ["Free relationship-preserving importer", "Yes", "No", "No", "No", "No"],
  ["Mobile kennel QR lookup", "Yes", "Limited", "Limited", "No", "No"],
  ["Adoption portal + Petfinder/Adopt-a-Pet sync", "Yes", "Yes", "Yes", "Yes", "Partial"],
  ["Foster + volunteer coordination", "Yes", "Add-on", "Limited", "Limited", "Yes (focus)"],
  ["Donor CRM + fundraising", "Yes", "Add-on", "Limited", "Add-on", "Limited"],
  ["Reliable payments (deposits/refunds)", "Yes", "Yes", "Yes", "Basic", "Basic"],
  ["All-in-one (no stitching tools)", "Yes", "Mostly", "Mostly", "No (modular)", "No"],
];

const PRICING = [
  {
    name: "Little Nest",
    price: "$0",
    tagline: "For solo fosters and tiny rescues — free forever, with our whole heart.",
    features: ["Up to 25 animals", "Free importer", "Adoption portal", "Kennel QR cards", "One-click export"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Rescue",
    price: "$39",
    tagline: "For growing rescues who need every hand coordinated.",
    features: ["Unlimited animals", "Foster + volunteer tools", "Donor CRM", "Email + SMS", "Everything in Little Nest"],
    cta: "Move in free",
    highlight: true,
  },
  {
    name: "Shelter Pro",
    price: "$79",
    tagline: "For shelters with a lobby, a van, and a waiting list.",
    features: ["Multi-location", "Petfinder / Adopt-a-Pet sync", "Fundraising campaigns", "Reports & analytics", "Everything in Rescue"],
    cta: "Move in free",
    highlight: false,
  },
  {
    name: "Custom",
    price: "Let's talk",
    tagline: "Municipal systems and coalitions — we'll build the aviary together.",
    features: ["SSO & roles", "Data pipelines", "Dedicated support", "Custom integrations"],
    cta: "Say hello",
    highlight: false,
  },
];

export default function Home() {
  return (
    <div>
      <SiteHeader />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="vt-fade-up">
            <h1 className="text-4xl sm:text-6xl font-display font-semibold leading-tight">
              Every animal deserves a{" "}
              <span className="text-meadow-deep">way home</span>.
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-charcoal-soft max-w-lg">
              The all-in-one platform for shelters, rescues, and fosters. Move in
              free, keep your data, keep your money.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/import"
                className="rounded-full bg-sunflower px-7 py-3.5 font-display font-semibold text-lg text-charcoal shadow-soft hover:shadow-lift transition-shadow"
              >
                Try the free importer
              </Link>
              <a
                href="#savings"
                className="rounded-full border-2 border-meadow px-7 py-3.5 font-display font-semibold text-lg text-meadow-deep hover:bg-meadow hover:text-white transition-colors"
              >
                See how much you'd save
              </a>
            </div>
          </div>
          <div className="relative h-72 sm:h-96" aria-hidden="true">
            {/* sunny meadow at golden hour */}
            <div className="absolute inset-x-0 bottom-0 h-40 rounded-t-[50%] bg-meadow/25" />
            <div className="absolute inset-x-10 bottom-0 h-24 rounded-t-[50%] bg-meadow/30" />
            <div className="absolute right-6 top-2 w-24 h-24 rounded-full bg-sunflower/70" />
            <DogDoodle className="absolute bottom-10 left-4 w-32 h-32 text-charcoal vt-float" />
            <CatDoodle className="absolute bottom-14 left-40 w-24 h-24 text-terracotta-deep vt-wiggle" />
            <WolfDoodle className="absolute bottom-8 right-24 w-28 h-28 text-sky-deep vt-float" />
            <BirdDoodle className="absolute top-10 left-24 w-16 h-16 text-meadow-deep vt-wiggle" />
            <PawDoodle className="absolute top-24 right-4 w-12 h-12 text-sunflower" />
          </div>
        </div>
      </section>

      {/* ---------- Pain -> Relief ---------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-display font-semibold text-center">
          Sound familiar?
        </h2>
        <p className="text-center text-charcoal-soft mt-2 text-lg">
          You didn't sign up to fight software. Here's the relief.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PAIN_RELIEF.map(({ pain, relief }) => (
            <div key={pain} className="rounded-blob bg-white shadow-soft p-6 flex flex-col gap-4">
              <p className="italic text-charcoal-soft">{pain}</p>
              <div className="flex items-start gap-3 mt-auto">
                <HeartPawDoodle className="w-8 h-8 shrink-0 text-meadow" />
                <p className="font-semibold">{relief}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Savings calculator ---------- */}
      <section id="savings" className="bg-white/70 py-16 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold text-center">
            You could save around{" "}
            <span className="text-meadow-deep">$2,000 a year</span> — and put it
            back into the animals.
          </h2>
          <p className="text-center text-charcoal-soft mt-2 text-lg">
            Drag the sliders to match your rescue.
          </p>
          <div className="mt-10">
            <SavingsCalculator />
          </div>
        </div>
      </section>

      {/* ---------- Comparison ---------- */}
      <section id="compare" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 scroll-mt-20">
        <h2 className="text-3xl sm:text-4xl font-display font-semibold text-center">
          How we compare
        </h2>
        <p className="text-center text-charcoal-soft mt-2 text-lg">
          We built the column we always wished existed.
        </p>
        <div className="mt-10 overflow-x-auto rounded-blob shadow-soft bg-white">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left">
                <th className="p-4"></th>
                <th className="p-4 bg-sunflower rounded-t-2xl font-display text-base">Via Tutela</th>
                <th className="p-4 font-semibold text-charcoal-soft">Shelterluv</th>
                <th className="p-4 font-semibold text-charcoal-soft">PetPoint</th>
                <th className="p-4 font-semibold text-charcoal-soft">RescueGroups</th>
                <th className="p-4 font-semibold text-charcoal-soft">Doobert</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(([label, vt, sl, pp, rg, db], i) => (
                <tr key={label} className={i % 2 ? "bg-cream/60" : ""}>
                  <td className="p-4 font-semibold">{label}</td>
                  <td className="p-4 bg-sunflower/50 font-bold">{vt}</td>
                  <td className="p-4">{sl}</td>
                  <td className="p-4">{pp}</td>
                  <td className="p-4">{rg}</td>
                  <td className="p-4">{db}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-charcoal-soft">
          *PetPoint is “free” only if the shelter promotes 24PetWatch microchips +
          ShelterCare insurance to adopters.
        </p>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="bg-white/70 py-16 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold text-center">
            Simple, flat, generous.
          </h2>
          <p className="text-center text-charcoal-soft mt-2 text-lg">
            No per-adoption fees. No cut of donations. No strings on your data.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-blob p-6 flex flex-col gap-4 ${
                  tier.highlight
                    ? "bg-sunflower shadow-lift scale-[1.02]"
                    : "bg-white shadow-soft"
                }`}
              >
                <h3 className="font-display font-semibold text-xl">{tier.name}</h3>
                <div>
                  <span className="text-4xl font-display font-bold">{tier.price}</span>
                  {tier.price.startsWith("$") && (
                    <span className="text-charcoal-soft font-semibold">/mo</span>
                  )}
                </div>
                <p className={`text-sm ${tier.highlight ? "text-charcoal" : "text-charcoal-soft"}`}>
                  {tier.tagline}
                </p>
                <ul className="text-sm space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2 items-start">
                      <span className="text-meadow-deep font-bold" aria-hidden="true">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/import"
                  className={`text-center rounded-full px-4 py-2.5 font-display font-semibold transition-shadow ${
                    tier.highlight
                      ? "bg-charcoal text-cream hover:shadow-lift"
                      : "bg-sunflower text-charcoal shadow-soft hover:shadow-lift"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Dignity of the small ---------- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-display font-semibold text-center">
          Built for the smallest rescue and the biggest shelter
        </h2>
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="rounded-blob bg-white shadow-soft p-8">
            <CatDoodle className="w-16 h-16 text-terracotta-deep" />
            <blockquote className="mt-4 text-lg">
              “It's just me, a spare bedroom, and three foster kittens at a time.
              Via Tutela treats my little operation like it matters — because it
              does.”
            </blockquote>
            <p className="mt-4 font-semibold text-charcoal-soft">
              — A solo foster, somewhere sunny <span className="text-sm">(placeholder)</span>
            </p>
          </div>
          <div className="rounded-blob bg-white shadow-soft p-8">
            <DogDoodle className="w-16 h-16 text-sky-deep" />
            <blockquote className="mt-4 text-lg">
              “We move four hundred animals a year through two buildings and a
              van. Everything finally lives in one place — and the kennel QR
              cards saved our staff hours every single day.”
            </blockquote>
            <p className="mt-4 font-semibold text-charcoal-soft">
              — A municipal shelter director <span className="text-sm">(placeholder)</span>
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <div className="rounded-blob bg-meadow text-white shadow-lift p-10 sm:p-14 relative overflow-hidden">
          <BirdDoodle className="absolute -top-2 right-6 w-20 h-20 text-white/40 vt-wiggle" />
          <h2 className="text-3xl sm:text-5xl font-display font-semibold">
            Move in free. We'll carry the boxes.
          </h2>
          <p className="mt-4 text-lg text-white/90">
            Bring every animal, every adopter, every bonded pair — our importer
            keeps the relationships intact. No account needed to try it.
          </p>
          <Link
            to="/import"
            className="inline-block mt-8 rounded-full bg-sunflower px-8 py-4 font-display font-semibold text-lg text-charcoal shadow-soft hover:shadow-lift transition-shadow"
          >
            Start your free import
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
