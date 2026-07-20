import { Link } from "react-router";
import type { Route } from "./+types/help.article";
import { requireUser } from "../../lib/auth.server";
import { HELP, getHelpArticle } from "../../lib/help";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.article.title ?? "Field Guide"} — Tutela` }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  await requireUser(context, request);
  const article = getHelpArticle(params.slug);
  if (!article) throw new Response("Not found", { status: 404 });
  const siblings = HELP.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 3);
  return { article, siblings };
}

/** [text](/path) → links; everything else renders as plain text. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!m) return <span key={i}>{part}</span>;
        return (
          <Link key={i} to={m[2]} className="font-semibold text-meadow-deep hover:underline">
            {m[1]}
          </Link>
        );
      })}
    </>
  );
}

export default function HelpArticle({ loaderData }: Route.ComponentProps) {
  const { article, siblings } = loaderData;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/app/help" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">
          ← Field Guide
        </Link>
        <h1 className="text-2xl font-display font-semibold">
          <span className="mr-2">{article.emoji}</span>
          {article.title}
        </h1>
        <p className="text-sm text-charcoal-soft">{article.summary}</p>
      </div>

      <div className="rounded-blob bg-white shadow-soft p-6 sm:p-8 space-y-4">
        {article.blocks.map((b, i) => (
          <div key={i}>
            {b.h2 && <h2 className="font-display font-semibold text-lg mt-2">{b.h2}</h2>}
            {b.p && (
              <p className="text-[15px] leading-relaxed mt-1">
                <Rich text={b.p} />
              </p>
            )}
            {b.steps && (
              <ol className="mt-2 space-y-2 list-none">
                {b.steps.map((s, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px]">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-meadow/15 text-meadow-deep text-xs font-bold flex items-center justify-center mt-0.5">
                      {j + 1}
                    </span>
                    <span><Rich text={s} /></span>
                  </li>
                ))}
              </ol>
            )}
            {b.list && (
              <ul className="mt-2 space-y-1.5 list-disc list-outside pl-5 text-[15px]">
                {b.list.map((item, j) => (
                  <li key={j}>
                    <Rich text={item} />
                  </li>
                ))}
              </ul>
            )}
            {b.tip && (
              <p className="mt-2 rounded-2xl bg-sunflower-soft/70 px-4 py-3 text-sm">
                <span className="font-semibold">💡 </span>
                <Rich text={b.tip} />
              </p>
            )}
          </div>
        ))}
      </div>

      {siblings.length > 0 && (
        <div>
          <h2 className="text-sm font-display font-semibold text-charcoal-soft">More in {article.category}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.slug}
                to={`/app/help/${s.slug}`}
                prefetch="intent"
                className="rounded-full bg-white shadow-soft px-4 py-2 text-sm font-semibold hover:shadow-lift transition-shadow"
              >
                {s.emoji} {s.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
