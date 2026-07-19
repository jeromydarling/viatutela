/** Header/footer chrome for a shelter's public website — renders from brand tokens. */

import type { NavLinkItem } from "../lib/site.server";
import {
  brandFontsHref,
  FONT_PAIRS,
  SITE_THEMES,
  DEFAULT_THEME,
  wordmarkStyle,
  wordmarkText,
  type Brand,
} from "../../workers/lib/brand";

/** Fonts + palette + THEME design language for a branded page. Render once. */
export function BrandStyle({ brand }: { brand: Brand }) {
  const pair = FONT_PAIRS[brand.typography] ?? FONT_PAIRS.friendly;
  const theme = SITE_THEMES[brand.theme] ?? SITE_THEMES[DEFAULT_THEME];
  return (
    <>
      <link rel="stylesheet" href={brandFontsHref(brand)} />
      <style>{`
        .brand-scope {
          --brand-primary: ${brand.palette.primary};
          --brand-accent: ${brand.palette.accent};
          --brand-ink: ${brand.palette.ink};
          --brand-bg: ${brand.palette.bg};
          --site-radius: ${theme.radius};
          --btn-radius: ${theme.buttonRadius};
          background: var(--brand-bg);
          background-image: ${theme.pattern(brand.palette)};
          color: var(--brand-ink);
          font-family: ${pair.body};
        }
        .brand-scope h1, .brand-scope h2, .brand-scope h3, .brand-scope .font-display {
          font-family: ${pair.heading};
          text-transform: ${theme.headingTransform};
          letter-spacing: ${theme.headingSpacing};
        }
        .brand-scope .site-card {
          border-radius: var(--site-radius);
          box-shadow: ${theme.cardShadow};
          background: #fff;
          overflow: hidden;
        }
        .brand-scope .site-photo {
          border-radius: calc(var(--site-radius) * 0.75);
          ${theme.photoFrame}
        }
        .brand-scope .site-btn { border-radius: var(--btn-radius); }
        .brand-scope .site-tint { background: color-mix(in srgb, var(--brand-primary) 8%, transparent); }
        .brand-scope .site-white { background: rgba(255,255,255,0.72); }
      `}</style>
    </>
  );
}

/** Themed divider between sections — the detail that kills the GeoCities feel. */
export function ThemeDivider({ brand }: { brand: Brand }) {
  const theme = SITE_THEMES[brand.theme] ?? SITE_THEMES[DEFAULT_THEME];
  const c = brand.palette.primary;
  switch (theme.divider) {
    case "wave":
      return (
        <svg aria-hidden viewBox="0 0 1200 40" className="w-full h-6 sm:h-8" preserveAspectRatio="none">
          <path d="M0 24 Q 150 4 300 24 T 600 24 T 900 24 T 1200 24" fill="none" stroke={c} strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "scallop":
      return (
        <svg aria-hidden viewBox="0 0 1200 26" className="w-full h-5" preserveAspectRatio="none">
          {Array.from({ length: 24 }, (_, i) => (
            <path key={i} d={`M${i * 50} 20 a 25 16 0 0 1 50 0`} fill="none" stroke={c} strokeOpacity="0.20" strokeWidth="2.5" />
          ))}
        </svg>
      );
    case "paws":
      return (
        <div aria-hidden className="flex justify-center gap-6 py-2 text-xl" style={{ color: c, opacity: 0.35 }}>
          <span className="-rotate-12">🐾</span>
          <span className="rotate-6">🐾</span>
          <span className="-rotate-3">🐾</span>
        </div>
      );
    case "line":
      return <hr aria-hidden className="mx-auto max-w-5xl border-t-2" style={{ borderColor: c, opacity: 0.25 }} />;
    default:
      return null;
  }
}

export function BrandLogo({ orgName, brand, className }: { orgName: string; brand: Brand; className?: string }) {
  if (brand.logo.kind === "image" && brand.logo.imageUrl) {
    return <img src={brand.logo.imageUrl} alt={`${orgName} logo`} className={className ?? "h-9"} />;
  }
  return (
    <span className={className} style={wordmarkStyle(brand)}>
      {wordmarkText(orgName, brand)}
    </span>
  );
}

export function ShelterSiteHeader({
  orgName,
  homeHref,
  nav,
  brand,
}: {
  orgName: string;
  homeHref: string;
  nav: NavLinkItem[];
  brand: Brand;
}) {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur border-b"
      style={{ background: `${brand.palette.bg}f2`, borderColor: `${brand.palette.primary}22` }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
        <a href={homeHref} className="text-xl truncate">
          <BrandLogo orgName={orgName} brand={brand} className="max-h-10" />
        </a>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {nav.map((l) => (
            <a
              key={`${l.label}-${l.href}`}
              href={l.href}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold opacity-80 hover:opacity-100 transition-opacity"
              style={{ color: brand.palette.ink }}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function ShelterSiteFooter({
  orgName,
  brand,
  email,
  phone,
  address,
}: {
  orgName: string;
  brand: Brand;
  email: string | null;
  phone: string | null;
  address: string | null;
}) {
  return (
    <footer
      className="mt-16 border-t py-10 text-center text-sm"
      style={{ borderColor: `${brand.palette.primary}22`, color: brand.palette.ink }}
    >
      <p className="text-base">
        <BrandLogo orgName={orgName} brand={brand} className="max-h-8 inline-block" />
      </p>
      {brand.tagline && <p className="mt-1 italic opacity-70">{brand.tagline}</p>}
      <p className="mt-2 space-x-3 opacity-80">
        {email && <span>{email}</span>}
        {phone && <span>{phone}</span>}
        {address && <span>{address}</span>}
      </p>
      <p className="mt-3 opacity-60">
        Powered by <a href="https://viatutela.app" className="font-semibold hover:underline">Via Tutela</a> · peace
        and all good things to you and your animals.
      </p>
    </footer>
  );
}

export function PreviewBanner() {
  return (
    <div className="bg-terracotta text-white text-center text-sm font-semibold py-2">
      Draft preview — this page isn't published yet. Only people with this link can see it.
    </div>
  );
}
