import { useState } from "react";
import { Link } from "react-router";

export function Logo({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <img
      src="/art/logo-dog.webp"
      alt=""
      className={`${className} rounded-full object-cover shadow-soft`}
      width={36}
      height={36}
    />
  );
}

const SECTIONS = [
  { href: "/#spotlight", label: "Adoption pages" },
  { href: "/#features", label: "Features" },
  { href: "/#savings", label: "Savings" },
  { href: "/#compare", label: "Compare" },
  { href: "/#pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-sunflower-soft">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16 gap-2">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold text-xl text-charcoal shrink-0">
          <Logo />
          Via&nbsp;Tutela
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3 text-sm font-semibold">
          {SECTIONS.slice(1).map((s) => (
            <a key={s.href} href={s.href} className="hidden md:block px-2 py-1 rounded-lg hover:bg-sunflower-soft transition-colors">
              {s.label}
            </a>
          ))}
          <Link to="/login" className="hidden sm:block px-2 py-1 rounded-lg hover:bg-sunflower-soft transition-colors">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-full bg-sunflower px-4 py-2 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow whitespace-nowrap"
          >
            Get started
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-lg"
          >
            {open ? "✕" : "☰"}
          </button>
        </nav>
      </div>
      {open && (
        <div className="md:hidden border-t border-sunflower-soft bg-cream px-4 pb-4 pt-2">
          <div className="grid gap-1">
            {SECTIONS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2.5 font-semibold hover:bg-sunflower-soft transition-colors"
              >
                {s.label}
              </a>
            ))}
            <a href="/demo" className="rounded-xl px-4 py-2.5 font-semibold hover:bg-sunflower-soft transition-colors">
              🌻 Live demo
            </a>
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 font-semibold hover:bg-sunflower-soft transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-full bg-sunflower px-4 py-2.5 text-center font-display font-semibold shadow-soft"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-sunflower-soft bg-white/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 font-display font-semibold text-charcoal">
          <Logo className="w-8 h-8" />
          Via Tutela
        </div>
        <p className="text-charcoal-soft text-center font-semibold">
          Peace and all good things to you and your animals.
        </p>
        <div className="flex gap-4 text-sm font-semibold text-charcoal-soft">
          <Link to="/signup" className="hover:text-charcoal">Get started</Link>
          <Link to="/import" className="hover:text-charcoal">Free importer</Link>
          <a href="/#pricing" className="hover:text-charcoal">Pricing</a>
        </div>
      </div>
    </footer>
  );
}
