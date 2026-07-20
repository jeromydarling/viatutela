import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/help";
import { requireUser } from "../../lib/auth.server";
import { HELP, helpByCategory } from "../../lib/help";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Field Guide — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  await requireUser(context, request);
  return {};
}

export default function Help(_: Route.ComponentProps) {
  const [q, setQ] = useState("");
  const groups = helpByCategory();
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? HELP.filter((a) =>
        [a.title, a.summary, a.category, ...a.blocks.flatMap((b) => [b.h2 ?? "", b.p ?? "", b.tip ?? "", ...(b.list ?? []), ...(b.steps ?? [])])]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-semibold">The Field Guide 🧭</h1>
        <p className="text-sm text-charcoal-soft max-w-2xl">
          Every corner of Tutela, explained like a friend would. {HELP.length} articles — search or browse.
          Can't find it? <Link to="/contact" className="font-semibold text-meadow-deep hover:underline">Write to us</Link>,
          a real person answers.
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder='Search the guide… try "zapier", "domain", "press kit", "export"'
        className="w-full max-w-xl rounded-xl border-2 border-cream bg-white px-4 py-2.5 focus:border-meadow outline-none"
      />

      {matches ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {matches.length === 0 && (
            <p className="text-charcoal-soft text-sm sm:col-span-2">
              Nothing matched — try a shorter word, or <Link to="/contact" className="font-semibold text-meadow-deep hover:underline">ask us directly</Link>.
            </p>
          )}
          {matches.map((a) => (
            <ArticleCard key={a.slug} slug={a.slug} emoji={a.emoji} title={a.title} summary={a.summary} />
          ))}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.category}>
            <h2 className="font-display font-semibold text-lg">{g.category}</h2>
            <div className="mt-2 grid sm:grid-cols-2 gap-3">
              {g.articles.map((a) => (
                <ArticleCard key={a.slug} slug={a.slug} emoji={a.emoji} title={a.title} summary={a.summary} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ArticleCard({ slug, emoji, title, summary }: { slug: string; emoji: string; title: string; summary: string }) {
  return (
    <Link
      to={`/app/help/${slug}`}
      prefetch="intent"
      className="rounded-blob bg-white shadow-soft p-4 hover:shadow-lift transition-shadow"
    >
      <div className="font-display font-semibold">
        <span className="mr-1.5">{emoji}</span>
        {title}
      </div>
      <p className="mt-1 text-xs text-charcoal-soft">{summary}</p>
    </Link>
  );
}
