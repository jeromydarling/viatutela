/**
 * Miniature, hand-built "screenshots" of the app for the marketing site —
 * real React markup in a chromeless browser frame, not images. Decorative:
 * every frame is aria-hidden with the real story told in the copy beside it.
 */

import { BirdDoodle, CatDoodle, DogDoodle, PawDoodle } from "./doodles";

export function BrowserFrame({
  children,
  url,
  className = "",
}: {
  children: React.ReactNode;
  url: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`select-none rounded-2xl bg-white shadow-lift overflow-hidden border border-cream ${className}`}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 bg-cream/70 border-b border-cream">
        <span className="w-2.5 h-2.5 rounded-full bg-terracotta/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-sunflower" />
        <span className="w-2.5 h-2.5 rounded-full bg-meadow/70" />
        <span className="ml-2 flex-1 truncate rounded-full bg-white px-2.5 py-0.5 text-[9px] text-charcoal-soft font-semibold">
          {url}
        </span>
      </div>
      <div className="p-3 bg-cream/40">{children}</div>
    </div>
  );
}

/* ---------- shared mini atoms ---------- */

function Chip({ children, tone = "sky" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    sky: "bg-sky/20 text-sky-deep",
    meadow: "bg-meadow/20 text-meadow-deep",
    sun: "bg-sunflower-soft text-charcoal",
    terra: "bg-terracotta/20 text-terracotta-deep",
  };
  return (
    <span className={`rounded-full px-1.5 py-px text-[8px] font-bold ${tones[tone]}`}>{children}</span>
  );
}

function MiniStat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-xl bg-white shadow-soft px-2 py-1.5 text-center">
      <div className="text-sm font-display font-bold text-meadow-deep leading-none">{n}</div>
      <div className="text-[7px] font-semibold text-charcoal-soft mt-0.5">{label}</div>
    </div>
  );
}

/* ---------- 1. importer ---------- */

export function ImporterScreen() {
  return (
    <BrowserFrame url="viatutela.pet/import" className="vt-float">
      <p className="text-[10px] font-display font-semibold">Reading shelter-export.csv…</p>
      <div className="mt-1.5 h-2 rounded-full bg-white overflow-hidden shadow-inner">
        <div className="h-full w-4/5 rounded-full bg-meadow" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <MiniStat n="4,981" label="rows read" />
        <MiniStat n="4,922" label="came in clean" />
        <MiniStat n="59" label="flagged" />
      </div>
      <div className="mt-2 rounded-xl bg-white shadow-soft p-2 space-y-1">
        {[
          ["Pet Name", "name"],
          ["K9 / Feline", "species"],
          ["Bonded With", "bonded pair ♥"],
        ].map(([from, to]) => (
          <div key={from} className="flex items-center gap-1 text-[8px] font-semibold">
            <span className="rounded bg-cream px-1.5 py-0.5">{from}</span>
            <span className="text-meadow-deep">→</span>
            <span className="rounded bg-meadow/15 text-meadow-deep px-1.5 py-0.5">{to}</span>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

/* ---------- 2. animal profile + kennel QR ---------- */

export function AnimalScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/animals/biscuit" className="vt-float">
      <div className="flex gap-2">
        <div className="w-12 h-12 rounded-xl bg-white shadow-soft flex items-center justify-center shrink-0">
          <DogDoodle className="w-9 h-9 text-charcoal" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-display font-bold leading-tight">Biscuit</p>
          <p className="text-[8px] text-charcoal-soft">dog · terrier mix · 4 yrs</p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <Chip>available</Chip>
            <Chip tone="sun">kennel K-7</Chip>
            <Chip tone="terra">bonded with Waffle</Chip>
          </div>
        </div>
        <div className="ml-auto w-11 h-11 shrink-0 rounded-lg bg-white shadow-soft p-1 grid grid-cols-5 grid-rows-5 gap-px">
          {[1,1,1,0,1, 1,0,1,1,0, 1,1,0,1,1, 0,1,1,0,1, 1,0,1,1,1].map((v, i) => (
            <span key={i} className={v ? "bg-charcoal rounded-[1px]" : ""} />
          ))}
        </div>
      </div>
      <div className="mt-2 rounded-xl bg-white shadow-soft p-2">
        <p className="text-[8px] font-bold text-charcoal-soft">MEDICAL</p>
        {[
          ["Jul 2", "DHPP booster", "meadow"],
          ["due Aug 1", "rabies 1yr", "terra"],
        ].map(([d, t, tone]) => (
          <div key={t} className="mt-1 flex items-center gap-1.5 text-[8px] font-semibold">
            <Chip tone={tone}>{d}</Chip>
            <span>{t}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        scan the kennel card → this profile, on your phone
      </p>
    </BrowserFrame>
  );
}

/* ---------- 3. adoption portal + application ---------- */

export function PortalScreen() {
  return (
    <BrowserFrame url="viatutela.pet/adopt/sunny-meadow" className="vt-float">
      <div className="rounded-lg bg-meadow px-2 py-1.5 text-center">
        <p className="text-[9px] font-display font-bold text-white">Sunny Meadow Rescue</p>
        <p className="text-[7px] text-white/80">7 friends waiting for a way home</p>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {[
          ["Mochi", CatDoodle, "text-terracotta-deep"],
          ["Ranger", DogDoodle, "text-sky-deep"],
          ["Clover", PawDoodle, "text-meadow-deep"],
        ].map(([name, D, color]) => {
          const Doodle = D as typeof DogDoodle;
          return (
            <div key={name as string} className="rounded-xl bg-white shadow-soft p-1.5 text-center">
              <Doodle className={`w-8 h-8 mx-auto ${color}`} />
              <p className="text-[8px] font-display font-bold">{name as string}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 rounded-xl bg-white shadow-soft p-2 flex items-center justify-between gap-2">
        <div className="text-[8px]">
          <p className="font-bold">New application 🎉</p>
          <p className="text-charcoal-soft">Frances B. wants to meet Mochi</p>
        </div>
        <span className="rounded-full bg-meadow text-white text-[8px] font-bold px-2 py-1">
          Approve
        </span>
      </div>
    </BrowserFrame>
  );
}

/* ---------- 4. fosters & people ---------- */

export function FosterScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/fosters" className="vt-float">
      <p className="text-[10px] font-display font-semibold">Foster care · 3 active stays</p>
      <div className="mt-1.5 space-y-1.5">
        {[
          ["Peanut", "with Clare F.", "since Jun 2", "meadow"],
          ["Storm", "with Anthony W.", "since Jul 8", "meadow"],
          ["Waffle + Biscuit", "with Rufino S.", "bonded pair", "terra"],
        ].map(([a, w, s, tone]) => (
          <div key={a} className="rounded-xl bg-white shadow-soft px-2 py-1.5 flex items-center gap-1.5 text-[8px] font-semibold">
            <PawDoodle className="w-4 h-4 text-sunflower shrink-0" />
            <span className="font-display font-bold text-[9px]">{a}</span>
            <span className="text-charcoal-soft">{w}</span>
            <span className="ml-auto"><Chip tone={tone}>{s}</Chip></span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        statuses sync themselves — no spreadsheet juggling
      </p>
    </BrowserFrame>
  );
}

/* ---------- 5. donations & campaigns ---------- */

export function DonationScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/donations" className="vt-float">
      <div className="grid grid-cols-3 gap-1.5">
        <MiniStat n="$1,240" label="last 30 days" />
        <MiniStat n="$8,915" label="this year" />
        <MiniStat n="$0" label="our cut, ever" />
      </div>
      <div className="mt-2 rounded-xl bg-white shadow-soft p-2">
        <div className="flex justify-between text-[8px] font-bold">
          <span>New Kennel Roof</span>
          <span>$3,650 of $5,000</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-cream overflow-hidden">
          <div className="h-full w-[73%] bg-meadow rounded-full" />
        </div>
      </div>
      <div className="mt-1.5 rounded-xl bg-white shadow-soft px-2 py-1.5 flex items-center gap-1.5 text-[8px] font-semibold">
        <span>💛</span>
        <span>Kind Neighbor gave <strong>$250</strong></span>
        <span className="ml-auto text-meadow-deep">receipt sent</span>
      </div>
    </BrowserFrame>
  );
}

/* ---------- adoption page share superpowers ---------- */

export function ShareScreen() {
  return (
    <BrowserFrame url="happypawsrescue.org/adopt/biscuit" className="vt-float">
      <div className="flex gap-2">
        <div className="w-14 h-14 rounded-xl bg-white shadow-soft flex items-center justify-center shrink-0 relative">
          <DogDoodle className="w-10 h-10 text-charcoal" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-white shadow text-[7px] px-1">🎬</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-display font-bold leading-tight">Biscuit</p>
          <p className="text-[8px] text-charcoal-soft">terrier mix · 4 yrs · loves squeaky toys</p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <Chip tone="terra">♥ bonded with Waffle</Chip>
            <Chip>video plays inline</Chip>
          </div>
        </div>
      </div>
      <div className="mt-2 rounded-xl bg-sunflower-soft/70 p-1.5">
        <p className="text-[8px] font-bold">Sharing is a superpower 💛</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {["↗ Share", "📘", "✖️", "💬", "📌", "🏘️", "✉️", "📱", "🔗", "▦ QR"].map((s) => (
            <span key={s} className="rounded-full bg-white shadow-soft px-1.5 py-0.5 text-[8px] font-bold">{s}</span>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1">
        <span className="flex-1 rounded-full bg-white shadow-soft px-1.5 py-1 text-[8px] font-bold text-center">🖨️ Print flyer</span>
        <span className="flex-1 rounded-full bg-white shadow-soft px-1.5 py-1 text-[8px] font-bold text-center">📦 Share kit</span>
        <span className="flex-1 rounded-full bg-white shadow-soft px-1.5 py-1 text-[8px] font-bold text-center">{"</>"} Embed</span>
      </div>
    </BrowserFrame>
  );
}

/* ---------- website builder / AI site designer ---------- */

export function WebsiteScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/website" className="vt-float">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-display font-semibold">Your website</p>
        <Chip tone="sky">✨ AI drafted 6 pages</Chip>
      </div>
      <div className="mt-1.5 space-y-1">
        {[
          ["Home", "hero · adoptable grid · newsletter", "meadow", "live"],
          ["About", "your story, written from your interview", "meadow", "live"],
          ["Donate", "cta band · faq", "sun", "draft"],
        ].map(([t, s, tone, st]) => (
          <div key={t} className="rounded-xl bg-white shadow-soft px-2 py-1 flex items-center gap-1.5 text-[8px]">
            <span className="font-display font-bold text-[9px]">{t}</span>
            <span className="text-charcoal-soft truncate">{s}</span>
            <span className="ml-auto"><Chip tone={tone}>{st}</Chip></span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 rounded-xl bg-white shadow-soft px-2 py-1.5 flex items-center gap-1.5 text-[8px] font-semibold">
        <span>🌐</span>
        <span>happypawsrescue.org</span>
        <span className="ml-auto"><Chip tone="meadow">SSL active</Chip></span>
      </div>
    </BrowserFrame>
  );
}

/* ---------- AI matchmaker quiz ---------- */

export function MatchScreen() {
  return (
    <BrowserFrame url="happypawsrescue.org/adopt/match" className="vt-float">
      <p className="text-[10px] font-display font-semibold text-center">Your matches 💛</p>
      <div className="mt-1.5 space-y-1.5">
        {[
          ["Mochi", CatDoodle, "92% match", "quiet apartment approved — Mochi naps professionally"],
          ["Clover", PawDoodle, "84% match", "gentle with kids, happy with your weekend hikes"],
        ].map(([name, D, score, why]) => {
          const Doodle = D as typeof CatDoodle;
          return (
            <div key={name as string} className="rounded-xl bg-white shadow-soft p-1.5 flex gap-1.5 items-center">
              <Doodle className="w-8 h-8 shrink-0 text-terracotta-deep" />
              <div className="min-w-0">
                <p className="text-[9px] font-display font-bold flex items-center gap-1">
                  {name as string} <Chip tone="meadow">{score as string}</Chip>
                </p>
                <p className="text-[7.5px] text-charcoal-soft leading-tight">{why as string}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        6 questions → their real available animals, ranked
      </p>
    </BrowserFrame>
  );
}

/* ---------- AI application triage ---------- */

export function TriageScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/applications" className="vt-float">
      <div className="rounded-xl bg-white shadow-soft p-2 text-[8px]">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-[9px]">Frances B.</span>
          <span className="text-charcoal-soft">wants to meet Mochi</span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Chip tone="meadow">fit 86/100</Chip>
          <Chip tone="sky">✨ AI review</Chip>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-[7.5px] font-semibold">
          <div className="text-meadow-deep">✓ vet reference given</div>
          <div className="text-meadow-deep">✓ works from home</div>
          <div className="text-terracotta-deep">⚑ landlord approval not mentioned</div>
          <div className="text-charcoal-soft">✉️ draft reply ready</div>
        </div>
      </div>
      <div className="mt-1.5 rounded-xl bg-white shadow-soft px-2 py-1.5 text-[8px] font-semibold flex items-center gap-1">
        <span>🐾</span> Possibly better fit: <span className="text-sky-deep font-bold">Pearl</span>
        <span className="text-charcoal-soft">— calmer, litter-trained</span>
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        AI ranks and flags — your people always decide
      </p>
    </BrowserFrame>
  );
}

/* ---------- brand studio ---------- */

export function BrandScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/brand" className="vt-float">
      <p className="text-[10px] font-display font-semibold">Brand Studio</p>
      <div className="mt-1.5 flex gap-1.5">
        {["#2e7d54", "#f6a445", "#2e2a26", "#fff6ea"].map((c) => (
          <div key={c} className="flex-1 rounded-lg shadow-soft overflow-hidden">
            <div className="h-6" style={{ background: c }} />
            <div className="bg-white text-center text-[6.5px] font-bold py-0.5">{c}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 rounded-xl bg-white shadow-soft p-2 text-center">
        <p className="font-display font-bold text-sm" style={{ color: "#2e7d54", letterSpacing: "0.04em" }}>
          Happy Paws Rescue
        </p>
        <p className="text-[7px] text-charcoal-soft italic">every friend deserves a sunny landing</p>
      </div>
      <div className="mt-1.5 flex gap-1 text-[8px] font-bold">
        <span className="flex-1 rounded-full bg-sunflower-soft px-1.5 py-1 text-center">✨ 3 answers → identity</span>
        <span className="flex-1 rounded-full bg-sunflower-soft px-1.5 py-1 text-center">📦 social kit</span>
      </div>
    </BrowserFrame>
  );
}

/* ---------- marketing studio ---------- */

export function MarketingScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/marketing" className="vt-float">
      <div className="rounded-xl bg-white shadow-soft p-2 text-[8px]">
        <div className="flex items-center gap-1">
          <span className="font-display font-bold text-[9px]">Meet Trailmix!</span>
          <Chip tone="sky">auto-drafted</Chip>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {["📘 Facebook", "📸 Instagram", "🎞️ Story", "📰 Press", "✉️ Email", "🔎 Ad Grants"].map((c) => (
            <span key={c} className="rounded-full bg-cream px-1.5 py-0.5 font-bold">{c}</span>
          ))}
        </div>
      </div>
      <div className="mt-1.5 rounded-xl bg-white shadow-soft p-2">
        <p className="text-[8px] font-bold">July calendar</p>
        <div className="mt-1 grid grid-cols-7 gap-0.5">
          {Array.from({ length: 21 }, (_, i) => (
            <span
              key={i}
              className={`h-3 rounded-sm ${[2, 5, 9, 12, 16, 19].includes(i) ? "bg-meadow/70" : "bg-cream"}`}
            />
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        drafts itself on adoptions & new arrivals — you press post
      </p>
    </BrowserFrame>
  );
}

/* ---------- waitlist alerts ---------- */

export function WaitlistScreen() {
  return (
    <BrowserFrame url="happypawsrescue.org/adopt" className="vt-float">
      <div className="rounded-xl bg-white shadow-soft p-2 text-center">
        <p className="text-[9px] font-display font-bold">Waiting for someone specific? 💛</p>
        <div className="mt-1 flex gap-1 justify-center text-[8px]">
          <span className="rounded-full bg-cream px-2 py-0.5 font-semibold">cat</span>
          <span className="rounded-full bg-cream px-2 py-0.5 font-semibold">"senior, calm"</span>
          <span className="rounded-full bg-sunflower px-2 py-0.5 font-bold">Tell me →</span>
        </div>
      </div>
      <div className="mt-2 rounded-xl bg-meadow/10 border-2 border-meadow/30 p-2 text-[8px]">
        <p className="font-bold">✉️ 3 weeks later…</p>
        <p className="mt-0.5">"You asked us to tell you — meet <strong>Pearl</strong>. Senior, silk-soft, completely over drama."</p>
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        missed visitors become a warm waiting list
      </p>
    </BrowserFrame>
  );
}

/* ---------- post-adoption lifecycle ---------- */

export function LifecycleScreen() {
  return (
    <BrowserFrame url="(your adopters' inboxes)" className="vt-float">
      <div className="space-y-1.5 text-[8px]">
        {[
          ["Day 3", "How are the first days with Biscuit? 3am zoomies are normal 🐾", "sky"],
          ["Week 2", "We'd love a photo — happy updates fuel this work", "meadow"],
          ["Month 6", "Half a year already 💛 (a gentle first give ask)", "sun"],
          ["1 year", "Happy Gotcha Day, Biscuit! 🎉", "terra"],
        ].map(([when, text, tone]) => (
          <div key={when as string} className="rounded-xl bg-white shadow-soft px-2 py-1.5 flex items-center gap-1.5">
            <Chip tone={tone as string}>{when as string}</Chip>
            <span className="min-w-0 truncate font-semibold">{text as string}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        scheduled on every adoption — returns down, donors up
      </p>
    </BrowserFrame>
  );
}

/* ---------- volunteers ---------- */

export function VolunteerScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/volunteers" className="vt-float">
      <div className="grid grid-cols-2 gap-1.5">
        <MiniStat n="1,204" label="volunteer hours (12 mo)" />
        <MiniStat n="23" label="active volunteers" />
      </div>
      <div className="mt-2 rounded-xl bg-white shadow-soft p-2 text-[8px]">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-[9px]">Saturday adoption event</span>
          <Chip tone="meadow">4/4 filled</Chip>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {["Clare", "Anthony", "Maya", "Priya"].map((n) => (
            <span key={n} className="rounded-full bg-cream px-1.5 py-0.5 font-semibold">{n}</span>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        the hour log every grant application asks for — kept automatically
      </p>
    </BrowserFrame>
  );
}

/* ---------- grant writer ---------- */

export function GrantScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/grants" className="vt-float">
      <div className="rounded-xl bg-white shadow-soft p-2 text-[8px]">
        <div className="flex items-center gap-1"><span className="font-display font-bold text-[9px]">Petco Love · $10,000</span><Chip tone="sky">✨ drafted</Chip></div>
        <p className="mt-1 text-charcoal-soft leading-tight">"## Statement of Need — In the last twelve months our foothills community brought us <strong>212 animals</strong>; we found homes for <strong>196</strong> in a median of <strong>19 days</strong>…"</p>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <MiniStat n="96" label="adoptions cited" />
        <MiniStat n="1,204" label="vol. hours cited" />
        <MiniStat n="6" label="sections written" />
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        your real numbers, funder-ready — never invented
      </p>
    </BrowserFrame>
  );
}

/* ---------- intake vision + vet OCR ---------- */

export function PaperworkScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/animals/new" className="vt-float">
      <div className="rounded-xl bg-white shadow-soft p-2 text-[8px]">
        <div className="flex items-center gap-1.5">
          <span className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center text-sm">📸</span>
          <div>
            <p className="font-bold">3 intake photos + "found on Route 9"</p>
            <p className="text-charcoal-soft">→ species, markings, age guess, first bio — prefilled</p>
          </div>
        </div>
      </div>
      <div className="mt-1.5 rounded-xl bg-white shadow-soft p-2 text-[8px]">
        <div className="flex items-center gap-1.5">
          <span className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center text-sm">📄</span>
          <div>
            <p className="font-bold">Photo of crumpled paper vet records</p>
            <p className="text-charcoal-soft">→ "2025-11-02 · vaccine · DHPP (Nobivac) · due 2026-11-02"</p>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        every guess labeled a guess · staff approve before anything saves
      </p>
    </BrowserFrame>
  );
}

/* ---------- transfer network ---------- */

export function NetworkScreen() {
  return (
    <BrowserFrame url="viatutela.pet/app/network" className="vt-float">
      <div className="space-y-1.5 text-[8px]">
        <div className="rounded-xl bg-white shadow-soft p-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-full bg-terracotta/15 text-terracotta-deep px-1.5 py-0.5 font-bold">NEEDS SPACE</span>
            <span className="font-display font-bold text-[9px]">Larkspur County AC</span>
            <Chip tone="terra">urgent</Chip>
          </div>
          <p className="mt-0.5">3 cats — kitten season hit hard. Can anyone take a litter?</p>
        </div>
        <div className="rounded-xl bg-white shadow-soft p-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-full bg-meadow/20 text-meadow-deep px-1.5 py-0.5 font-bold">HAS SPACE</span>
            <span className="font-display font-bold text-[9px]">Sunny Meadow Rescue</span>
          </div>
          <p className="mt-0.5">Two open foster homes for small dogs. ✉️ Reach out</p>
        </div>
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft">
        one board, every rescue on Tutela — the group text, retired
      </p>
    </BrowserFrame>
  );
}

/* ---------- 6. reports ---------- */

export function ReportsScreen() {
  const bars = [3, 5, 4, 7, 6, 9, 8, 11, 9, 12, 10, 14];
  return (
    <BrowserFrame url="viatutela.pet/app/reports" className="vt-float">
      <p className="text-[10px] font-display font-semibold">Adoptions by month</p>
      <div className="mt-1.5 flex items-end gap-1 h-16 rounded-xl bg-white shadow-soft p-2">
        {bars.map((b, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${i === bars.length - 1 ? "bg-sunflower" : "bg-meadow"}`}
            style={{ height: `${(b / 14) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <MiniStat n="96" label="adoptions (12 mo)" />
        <MiniStat n="18" label="avg days to home" />
        <MiniStat n="87%" label="approval rate" />
      </div>
      <p className="mt-1.5 text-[8px] text-center font-semibold text-charcoal-soft flex items-center justify-center gap-1">
        <BirdDoodle className="w-3.5 h-3.5 text-meadow-deep" />
        every number is one more friend home
      </p>
    </BrowserFrame>
  );
}
