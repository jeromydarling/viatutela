import { Link } from "react-router";
import type { Route } from "./+types/home";
import { SiteHeader, SiteFooter } from "../components/site";
import { SavingsCalculator } from "../components/savings-calculator";
import { BirdDoodle, HeartPawDoodle } from "../components/doodles";
import {
  AnimalScreen,
  BrandScreen,
  DonationScreen,
  FosterScreen,
  ImporterScreen,
  MarketingScreen,
  MatchScreen,
  PortalScreen,
  ReportsScreen,
  ShareScreen,
  TriageScreen,
  WebsiteScreen,
} from "../components/feature-screens";

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
    relief: "One platform: animals, adoptions, fosters, donors, website, brand, marketing.",
  },
];

const FEATURES: {
  title: string;
  body: string;
  screen: React.ComponentType;
  link?: { label: string; to: string };
}[] = [
  {
    title: "A real website, designed in one conversation",
    body: "Answer five questions and the AI designer drafts your whole site — home, about, adopt, donate — as drafts you approve, never auto-published. Build with friendly blocks, publish on your own domain with automatic SSL, and your sitemap and Google structured data come along for free.",
    screen: WebsiteScreen,
  },
  {
    title: "A matchmaker that knows your actual animals",
    body: "Adopters answer six quick questions and the AI ranks your real, currently-available friends for their home — energy, kids, other pets, experience. Bonded pairs stay together. Fewer mismatches, fewer returns, more forever homes.",
    screen: MatchScreen,
  },
  {
    title: "An inbox that triages itself",
    body: "Every application gets a fit score, green and red flags drawn only from what the applicant actually wrote, better-fit suggestions, and a warm draft reply. AI ranks and flags — your people always make the call.",
    screen: TriageScreen,
  },
  {
    title: "Your brand, in a box",
    body: "Palette, typography, a typeset wordmark that never breaks, your tagline, your voice — defined once and applied to your website, emails, flyers, and a downloadable social kit any volunteer can grab. No designer needed; three answers and the AI proposes the whole identity.",
    screen: BrandScreen,
  },
  {
    title: "Marketing that drafts itself",
    body: "New arrival? A launch kit appears. Adoption day? A success story is waiting. Eleven channels — Facebook to press releases to Google Ad Grants — drafted in your voice, on a calendar, sent to your supporter list with polite one-click unsubscribe. Nothing ever posts without you.",
    screen: MarketingScreen,
  },
  {
    title: "Move in free — relationships and all",
    body: "Upload the messy exports from your old system. Adopters stay linked to their animals, medical history follows every friend, and bonded pairs stay bonded. Flagged rows land in a tidy report instead of the void.",
    screen: ImporterScreen,
    link: { label: "Try the importer", to: "/import" },
  },
  {
    title: "One profile per friend, one scan away",
    body: "Photos, medical timeline, foster status, microchip — all on one page. Print a kennel card with a QR code and the full profile opens on your phone, right there in the kennel aisle.",
    screen: AnimalScreen,
  },
  {
    title: "Your own adoption page, applications included",
    body: "Every rescue gets a warm public page at your own link. Applications arrive in an inbox where one click approves, records the adoption, and emails the good news.",
    screen: PortalScreen,
  },
  {
    title: "Fosters and people, finally in one place",
    body: "Start and end foster stays in two clicks — animal statuses keep themselves honest. Adopters, fosters, volunteers, and donors live in one gentle CRM with their whole history.",
    screen: FosterScreen,
  },
  {
    title: "Generosity, honored properly",
    body: "Record gifts, run campaigns with goals and progress bars, and send thank-you receipts automatically. We never take a cent of your donations.",
    screen: DonationScreen,
  },
  {
    title: "Know your numbers, love your outcomes",
    body: "Intakes, adoptions, days-to-home, donation trends, application funnel — clear charts your board will actually read, computed live from your data.",
    screen: ReportsScreen,
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
  ["Share bar, flyers, videos, embed on every animal", "Yes", "Limited", "Limited", "Limited", "No"],
  ["Website builder + custom domain + auto SSL", "Yes", "No", "No", "Basic", "No"],
  ["AI matchmaker, triage, bios & marketing copilot", "Yes", "No", "No", "No", "No"],
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
    features: ["Up to 25 animals", "Free importer", "Adoption pages with share superpowers", "Website builder", "Kennel QR cards", "One-click export"],
    cta: "Sign up free",
    highlight: false,
  },
  {
    name: "Rescue",
    price: "$39",
    tagline: "For growing rescues who need every hand coordinated.",
    features: ["Unlimited animals", "Foster + volunteer tools", "Donor CRM + supporter email", "AI matchmaker, triage & bio writer", "Custom domain + auto SSL", "Everything in Little Nest"],
    cta: "Sign up free",
    highlight: true,
  },
  {
    name: "Shelter Pro",
    price: "$79",
    tagline: "For shelters with a lobby, a van, and a waiting list.",
    features: ["Multi-location", "Brand + Marketing studios", "AI site designer & insights", "Petfinder sync + fundraising", "Reports & analytics", "Everything in Rescue"],
    cta: "Sign up free",
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

function MiniCta({ text, label = "Sign up free", to = "/signup" }: { text: string; label?: string; to?: string }) {
  return (
    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
      <span className="font-display font-semibold text-lg">{text}</span>
      <Link
        to={to}
        className="rounded-full bg-sunflower px-5 py-2.5 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow whitespace-nowrap"
      >
        {label}
      </Link>
    </div>
  );
}

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
                to="/signup"
                className="rounded-full bg-sunflower px-7 py-3.5 font-display font-semibold text-lg text-charcoal shadow-soft hover:shadow-lift transition-shadow"
              >
                Sign up free
              </Link>
              <a
                href="/demo"
                className="rounded-full border-2 border-meadow px-7 py-3.5 font-display font-semibold text-lg text-meadow-deep hover:bg-meadow hover:text-white transition-colors"
              >
                🌻 Take the live demo for a spin
              </a>
            </div>
            <p className="mt-3 text-sm text-charcoal-soft">
              No credit card, free forever for small rescues. Migrating?{" "}
              <Link to="/import" className="font-semibold text-meadow-deep hover:underline">
                The free importer keeps every relationship →
              </Link>
            </p>
          </div>
          <div className="relative" aria-hidden="true">
            <img
              src="/art/meadow.webp"
              alt=""
              width={1000}
              height={750}
              className="rounded-blob shadow-lift rotate-1 w-full"
            />
            <img
              src="/art/wander.webp"
              alt=""
              width={512}
              height={512}
              className="absolute -bottom-8 -left-6 w-24 h-24 rounded-full shadow-soft -rotate-6 vt-float bg-cream"
            />
          </div>
        </div>
      </section>

      {/* ---------- Spotlight: the adoption page ---------- */}
      <section id="spotlight" className="bg-meadow py-16 overflow-hidden scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
          <div className="max-w-sm w-full mx-auto md:order-2 md:-rotate-1">
            <ShareScreen />
          </div>
          <div className="text-white md:order-1">
            <p className="font-display font-semibold text-sunflower uppercase tracking-wide text-sm">
              The heart of it all
            </p>
            <h2 className="mt-2 text-3xl sm:text-5xl font-display font-semibold leading-tight">
              Every animal gets the internet's best adoption page.
            </h2>
            <p className="mt-4 text-lg text-white/90 leading-relaxed">
              Photos <em>and videos</em>. A share bar with every channel your volunteers already use —
              Facebook, Nextdoor, WhatsApp, texts, QR codes. A print-ready flyer in your brand. An embed
              widget for the vet's website. A share kit anyone can download. Links that unfurl with the
              animal's photo in every group chat.
            </p>
            <ul className="mt-5 space-y-2 text-white/95 font-semibold">
              {[
                "One-tap sharing to 10+ places — most adoptions start with a friend's repost",
                "🖨️ Print a branded flyer → Save as PDF in ten seconds",
                "🎬 30-second videos that play right on the page",
                "💛 A 6-question AI match quiz that points adopters to the right friend",
              ].map((li) => (
                <li key={li} className="flex gap-2 items-start">
                  <span aria-hidden>✓</span>
                  {li}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow"
              >
                Give every animal this page — sign up free
              </Link>
              <Link
                to="/adopt/sunny-meadow-demo"
                className="rounded-full border-2 border-white/70 px-6 py-3 font-display font-semibold text-white hover:bg-white hover:text-meadow-deep transition-colors"
              >
                See a live one →
              </Link>
            </div>
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
        <MiniCta text="The relief part is free to try." />
      </section>

      {/* ---------- Features with mini screenshots ---------- */}
      <section id="features" className="bg-white/70 py-16 scroll-mt-20 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold text-center">
            Everything under one sunny roof
          </h2>
          <p className="text-center text-charcoal-soft mt-2 text-lg">
            A peek inside — these little windows are the real app, in miniature.
          </p>
          <div className="mt-12 space-y-16">
            {FEATURES.map((f, i) => {
              const Screen = f.screen;
              return (
                <div
                  key={f.title}
                  className={`grid md:grid-cols-2 gap-8 items-center ${
                    i % 2 ? "md:[direction:rtl]" : ""
                  }`}
                >
                  <div className="md:[direction:ltr]">
                    <h3 className="text-2xl font-display font-semibold">{f.title}</h3>
                    <p className="mt-3 text-lg text-charcoal-soft leading-relaxed">{f.body}</p>
                    {f.link && (
                      <Link
                        to={f.link.to}
                        className="inline-block mt-4 rounded-full bg-sunflower px-5 py-2.5 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow"
                      >
                        {f.link.label}
                      </Link>
                    )}
                  </div>
                  <div className={`md:[direction:ltr] max-w-sm w-full mx-auto ${i % 2 ? "md:-rotate-1" : "md:rotate-1"}`}>
                    <Screen />
                  </div>
                </div>
              );
            })}
          </div>
          <MiniCta text="Every window you just peeked into is included." />
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
          <MiniCta text="Keep the two grand — the animals have plans for it." />
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
        <MiniCta text="Life's better in the left column." label="Sign up free" />
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
                  to={tier.price.startsWith("$") ? "/signup" : "/import"}
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
            <img src="/art/cat.webp" alt="" width={512} height={512} className="w-24 h-24 rounded-3xl shadow-soft -rotate-2" />
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
            <img src="/art/dog-bounce.webp" alt="" width={512} height={512} className="w-24 h-24 rounded-3xl shadow-soft rotate-2" />
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
            Two minutes to a working shelter platform — and if you're coming from
            another system, the importer brings every animal, adopter, and bonded
            pair along with the relationships intact.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/signup"
              className="rounded-full bg-sunflower px-8 py-4 font-display font-semibold text-lg text-charcoal shadow-soft hover:shadow-lift transition-shadow"
            >
              Sign up free
            </Link>
            <Link
              to="/import"
              className="rounded-full border-2 border-white/70 px-8 py-4 font-display font-semibold text-lg text-white hover:bg-white hover:text-meadow-deep transition-colors"
            >
              Start with an import
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
