/** Header/footer chrome for a shelter's public website. */

import type { NavLinkItem } from "../lib/site.server";

export function ShelterSiteHeader({
  orgName,
  homeHref,
  nav,
  accent,
}: {
  orgName: string;
  homeHref: string;
  nav: NavLinkItem[];
  accent: string;
}) {
  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-sunflower-soft">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
        <a href={homeHref} className="font-display font-semibold text-xl truncate" style={{ color: accent }}>
          {orgName}
        </a>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {nav.map((l) => (
            <a
              key={`${l.label}-${l.href}`}
              href={l.href}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold text-charcoal-soft hover:bg-sunflower-soft hover:text-charcoal transition-colors"
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
  email,
  phone,
  address,
}: {
  orgName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}) {
  return (
    <footer className="mt-16 border-t border-sunflower-soft bg-white/60 py-10 text-center text-sm text-charcoal-soft">
      <p className="font-display font-semibold text-base text-charcoal">{orgName}</p>
      <p className="mt-1 space-x-3">
        {email && <span>{email}</span>}
        {phone && <span>{phone}</span>}
        {address && <span>{address}</span>}
      </p>
      <p className="mt-3">
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
