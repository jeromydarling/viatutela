import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/integrations.recipes";
import { requireUser } from "../../lib/auth.server";
import { RECIPES, RECIPE_CATEGORIES, TRIGGER_LABELS, type Recipe } from "../../lib/automation-recipes";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Automation recipes — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  await requireUser(context, request);
  return { origin: new URL(request.url).origin };
}

const chipCls = (active: boolean) =>
  `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
    active ? "bg-meadow text-white" : "bg-white shadow-soft text-charcoal-soft hover:bg-sunflower-soft"
  }`;

function RecipeCard({ r }: { r: Recipe }) {
  return (
    <details className="rounded-blob bg-white shadow-soft p-5 open:shadow-lift transition-shadow">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold">{r.title}</h3>
          <span className="shrink-0 rounded-full bg-sky/20 text-sky-deep text-[11px] font-semibold px-2 py-0.5">
            {r.category}
          </span>
        </div>
        <p className="mt-1 text-sm text-charcoal-soft">{r.what}</p>
        <p className="mt-2 text-xs font-semibold text-charcoal-soft">
          <span className="rounded-full bg-sunflower-soft px-2 py-0.5">⚡ {TRIGGER_LABELS[r.trigger]}</span>
          <span className="ml-2">→ {r.apps.join(" / ")}</span>
        </p>
      </summary>
      <ol className="mt-3 space-y-1.5 text-sm list-decimal list-inside text-charcoal">
        {r.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  );
}

export default function AutomationRecipes({ loaderData }: Route.ComponentProps) {
  const [cat, setCat] = useState<string>("");
  const shown = cat ? RECIPES.filter((r) => r.category === cat) : RECIPES;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/settings/integrations" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">
          ← Integrations
        </Link>
        <h1 className="text-2xl font-display font-semibold">Automation recipes</h1>
        <p className="text-sm text-charcoal-soft max-w-2xl">
          {RECIPES.length} ready-to-build automations for Zapier, Make, or n8n. Each one starts from a
          Tutela webhook, your API key, or the shift calendar — set up once, runs forever.
        </p>
      </div>

      <section className="rounded-blob bg-sunflower-soft/60 p-5 text-sm max-w-3xl">
        <h2 className="font-display font-semibold">One-time setup (every webhook recipe starts here)</h2>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>In Zapier, create a Zap with trigger <strong>Webhooks by Zapier → Catch Hook</strong> and copy the hook URL it gives you.</li>
          <li>In <Link to="/app/settings/integrations" className="font-semibold text-meadow-deep hover:underline">Settings → Integrations</Link>, add that URL as a webhook and tick the event the recipe uses.</li>
          <li>Press <em>Send test ping</em> so Zapier catches a sample, then map the fields from <code>data</code> into the action steps below.</li>
        </ol>
        <p className="mt-2 text-xs text-charcoal-soft">
          Make and n8n work identically — both have a "webhook" trigger node that hands you a URL.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button className={chipCls(cat === "")} onClick={() => setCat("")}>
          All ({RECIPES.length})
        </button>
        {RECIPE_CATEGORIES.map((c) => (
          <button key={c} className={chipCls(cat === c)} onClick={() => setCat(c)}>
            {c} ({RECIPES.filter((r) => r.category === c).length})
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {shown.map((r) => (
          <RecipeCard key={r.slug} r={r} />
        ))}
      </div>

      <p className="text-sm text-charcoal-soft max-w-2xl">
        Built something clever? We'd love to hear about it — and if a recipe needs an event we don't
        send yet, tell us that too.
      </p>
    </div>
  );
}
