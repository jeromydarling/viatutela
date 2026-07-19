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
    <BrowserFrame url="viatutela.app/import" className="vt-float">
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
    <BrowserFrame url="viatutela.app/app/animals/biscuit" className="vt-float">
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
    <BrowserFrame url="viatutela.app/adopt/sunny-meadow" className="vt-float">
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
    <BrowserFrame url="viatutela.app/app/fosters" className="vt-float">
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
    <BrowserFrame url="viatutela.app/app/donations" className="vt-float">
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

/* ---------- 6. reports ---------- */

export function ReportsScreen() {
  const bars = [3, 5, 4, 7, 6, 9, 8, 11, 9, 12, 10, 14];
  return (
    <BrowserFrame url="viatutela.app/app/reports" className="vt-float">
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
