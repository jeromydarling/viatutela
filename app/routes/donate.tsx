import { useState } from "react";
import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/donate";
import { getEnv } from "../lib/auth.server";
import { parseBrandJson } from "../../workers/lib/brand";
import { BrandStyle } from "../components/site-chrome";
import { HeartPawDoodle } from "../components/doodles";
import {
  createDonationCheckout,
  feeCoverCents,
  stripeAvailable,
} from "../../workers/lib/stripe";

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [];
  return [
    { title: `Donate to ${d.org.name}` },
    { name: "description", content: `Every dollar helps ${d.org.name} get more friends home.` },
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(
    `SELECT id, name, slug, about, email, brand_json, stripe_account_id, stripe_charges_enabled, demo FROM orgs WHERE slug = ?`,
  )
    .bind(params.slug)
    .first<Record<string, string | number | null>>();
  if (!org) throw new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  return {
    org: { name: String(org.name), slug: String(org.slug), about: org.about, email: org.email },
    brand: parseBrandJson(org.brand_json as string | null),
    live: Boolean(stripeAvailable(env) && org.stripe_account_id && org.stripe_charges_enabled && !org.demo),
    demo: Boolean(org.demo),
    thanks: url.searchParams.get("thanks") === "1",
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const env = getEnv(context);
  const org = await env.DB.prepare(
    `SELECT id, name, slug, stripe_account_id, stripe_charges_enabled, demo FROM orgs WHERE slug = ?`,
  )
    .bind(params.slug)
    .first<Record<string, string | number | null>>();
  if (!org) throw new Response("Not found", { status: 404 });
  if (!stripeAvailable(env) || !org.stripe_account_id || !org.stripe_charges_enabled || org.demo) {
    return data({ error: "Online giving isn't set up for this shelter yet." }, 400);
  }

  const f = await request.formData();
  const raw = String(f.get("amount") === "custom" ? f.get("custom_amount") : f.get("amount") ?? "").replace(/[$,\s]/g, "");
  const dollars = Number(raw);
  if (!isFinite(dollars) || dollars < 1 || dollars > 25_000) {
    return data({ error: "Pick an amount between $1 and $25,000." }, 400);
  }
  const baseCents = Math.round(dollars * 100);

  try {
    const url = await createDonationCheckout(env, {
      accountId: String(org.stripe_account_id),
      orgId: String(org.id),
      orgName: String(org.name),
      slug: String(org.slug),
      baseCents,
      coverFees: Boolean(f.get("cover_fees")),
      monthly: f.get("frequency") === "monthly",
      origin: new URL(request.url).origin,
    });
    return redirect(url);
  } catch (err) {
    console.log(`[donate checkout] ${err instanceof Error ? err.message : err}`);
    return data({ error: "Something hiccuped starting checkout — please try again in a moment." }, 500);
  }
}

const PRESETS = [10, 25, 50, 100];

export default function Donate({ loaderData, actionData }: Route.ComponentProps) {
  const { org, brand, live, demo, thanks } = loaderData;
  const a = actionData as { error?: string } | undefined;
  const [amount, setAmount] = useState<string>("25");
  const [custom, setCustom] = useState<string>("");
  const [cover, setCover] = useState(true);

  const baseCents = Math.round((amount === "custom" ? Number(custom) || 0 : Number(amount)) * 100);
  const coverCents = baseCents >= 100 ? feeCoverCents(baseCents) : 0;

  return (
    <div className="brand-scope min-h-screen bg-cream">
      <BrandStyle brand={brand} />
      <main className="mx-auto max-w-lg px-4 sm:px-6 py-12">
        <div className="text-center">
          <HeartPawDoodle className="w-14 h-14 mx-auto text-terracotta" />
          <h1 className="mt-3 text-3xl font-display font-semibold">Give to {org.name}</h1>
          {org.about && <p className="mt-2 text-charcoal-soft">{String(org.about)}</p>}
        </div>

        {thanks ? (
          <div className="mt-8 rounded-blob bg-white shadow-soft p-8 text-center">
            <p className="text-2xl">💚</p>
            <h2 className="mt-2 text-xl font-display font-semibold">Thank you!</h2>
            <p className="mt-2 text-charcoal-soft">
              Your gift is on its way to {org.name}. A receipt from the shelter is in your email.
            </p>
            <Link to={`/adopt/${org.slug}`} className="mt-4 inline-block font-semibold text-meadow-deep hover:underline">
              Meet the friends you're helping →
            </Link>
          </div>
        ) : !live ? (
          <div className="mt-8 rounded-blob bg-white shadow-soft p-8 text-center">
            <p className="text-charcoal-soft">
              {demo
                ? "This is the demo shelter — online giving is switched off here, but this is exactly where your donors would land."
                : `${org.name} hasn't switched on online giving yet.`}
            </p>
            {!demo && org.email && (
              <p className="mt-3">
                <a href={`mailto:${org.email}`} className="font-semibold text-meadow-deep hover:underline">
                  Email the shelter about donating →
                </a>
              </p>
            )}
          </div>
        ) : (
          <Form method="post" className="mt-8 rounded-blob bg-white shadow-soft p-6 sm:p-8 space-y-5">
            {a?.error && <p className="rounded-2xl bg-terracotta/15 text-terracotta-deep px-4 py-2.5 font-semibold">{a.error}</p>}

            <fieldset>
              <legend className="font-display font-semibold">Amount</legend>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {PRESETS.map((p) => (
                  <label key={p} className={`text-center rounded-xl border-2 px-2 py-2.5 font-semibold cursor-pointer ${amount === String(p) ? "border-meadow bg-meadow/10" : "border-cream bg-cream"}`}>
                    <input type="radio" name="amount" value={p} checked={amount === String(p)} onChange={() => setAmount(String(p))} className="sr-only" />
                    ${p}
                  </label>
                ))}
                <label className={`text-center rounded-xl border-2 px-2 py-2.5 font-semibold cursor-pointer ${amount === "custom" ? "border-meadow bg-meadow/10" : "border-cream bg-cream"}`}>
                  <input type="radio" name="amount" value="custom" checked={amount === "custom"} onChange={() => setAmount("custom")} className="sr-only" />
                  Other
                </label>
              </div>
              {amount === "custom" && (
                <input
                  name="custom_amount"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  inputMode="decimal"
                  placeholder="$ amount"
                  className="mt-2 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 focus:border-meadow outline-none"
                />
              )}
            </fieldset>

            <fieldset>
              <legend className="font-display font-semibold">Frequency</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="rounded-xl border-2 border-cream bg-cream px-3 py-2.5 text-center font-semibold cursor-pointer has-[:checked]:border-meadow has-[:checked]:bg-meadow/10">
                  <input type="radio" name="frequency" value="once" defaultChecked className="sr-only" />
                  One time
                </label>
                <label className="rounded-xl border-2 border-cream bg-cream px-3 py-2.5 text-center font-semibold cursor-pointer has-[:checked]:border-meadow has-[:checked]:bg-meadow/10">
                  <input type="radio" name="frequency" value="monthly" className="sr-only" />
                  Monthly 💚
                </label>
              </div>
            </fieldset>

            <label className="flex gap-2.5 items-start text-sm">
              <input type="checkbox" name="cover_fees" checked={cover} onChange={(e) => setCover(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-semibold">
                  Add {coverCents > 0 ? `$${(coverCents / 100).toFixed(2)}` : "a little"} to cover the fees
                </span>{" "}
                so {org.name} receives your full gift. This covers card processing and Tutela's 2% platform
                fee — the whole cost of running this page.
              </span>
            </label>

            <button className="w-full rounded-full bg-meadow text-white py-3 font-display font-semibold text-lg shadow-soft hover:shadow-lift transition-shadow">
              {baseCents >= 100
                ? `Give $${((baseCents + (cover ? coverCents : 0)) / 100).toFixed(2)}`
                : "Give"}
            </button>
            <p className="text-xs text-charcoal-soft text-center">
              Secure checkout by Stripe. {org.name} is the recipient of record — your receipt comes from them.
            </p>
          </Form>
        )}
      </main>
    </div>
  );
}
