import { Link } from "react-router";
import { BirdDoodle } from "./doodles";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-sunflower-soft">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold text-xl text-charcoal">
          <BirdDoodle className="w-9 h-9 text-meadow-deep" title="Via Tutela" />
          Via&nbsp;Tutela
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm font-semibold">
          <a href="/#savings" className="hidden sm:block px-2 py-1 rounded-lg hover:bg-sunflower-soft transition-colors">
            Savings
          </a>
          <a href="/#compare" className="hidden sm:block px-2 py-1 rounded-lg hover:bg-sunflower-soft transition-colors">
            Compare
          </a>
          <a href="/#pricing" className="hidden sm:block px-2 py-1 rounded-lg hover:bg-sunflower-soft transition-colors">
            Pricing
          </a>
          <Link
            to="/import"
            className="rounded-full bg-sunflower px-4 py-2 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow"
          >
            Try the free importer
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-sunflower-soft bg-white/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 font-display font-semibold text-charcoal">
          <BirdDoodle className="w-8 h-8 text-meadow-deep" />
          Via Tutela
        </div>
        <p className="text-charcoal-soft text-center font-semibold">
          Peace and all good things to you and your animals.
        </p>
        <div className="flex gap-4 text-sm font-semibold text-charcoal-soft">
          <Link to="/import" className="hover:text-charcoal">Free importer</Link>
          <a href="/#pricing" className="hover:text-charcoal">Pricing</a>
        </div>
      </div>
    </footer>
  );
}
