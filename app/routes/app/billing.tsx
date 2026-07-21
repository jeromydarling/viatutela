import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/billing";
import { requireUser } from "../../lib/auth.server";
import { PLANS, fmtCents, STARTER_USAGE_CAP_CENTS } from "../../../workers/lib/pricing";
import {
  FREE_ADOPTION_GRACE,
  billingState,
  createBillingPortal,
  createSubscriptionCheckout,
} from "../../../workers/lib/subscription";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Billing — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const url = new URL(request.url);
  const state = await billingState(env, user.org_id);
  const usage = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) c FROM billing_usage
     WHERE org_id = ? AND created_at >= datetime('now', 'start of month')`,
  )
    .bind(user.org_id)
    .first<{ c: number }>();
  return {
    state,
    plan: PLANS[state.plan] ?? PLANS.starter,
    usageThisMonthCents: usage?.c ?? 0,
    capCents: STARTER_USAGE_CAP_CENTS,
    grace: FREE_ADOPTION_GRACE,
    welcome: url.searchParams.get("welcome") === "1",
    isDemo: Boolean(user.demo),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  if (user.demo) return { error: "The demo can look but not add a real payment method. 🌻" };
  const origin = new URL(request.url).origin;

  const org = await env.DB.prepare(`SELECT name, email FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ name: string; email: string | null }>();

  try {
    if (intent === "add-method") {
      const dest = await createSubscriptionCheckout(env, {
        orgId: user.org_id,
        orgName: org?.name ?? "Your shelter",
        email: org?.email ?? user.email,
        origin,
      });
      return redirect(dest);
    }
    if (intent === "manage") {
      const dest = await createBillingPortal(env, user.org_id, `${origin}/app/settings/billing`);
      return redirect(dest);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Stripe had a hiccup — try again in a minute." };
  }
  return null;
}

export default function Billing({ loaderData, actionData }: Route.ComponentProps) {
  const { state, plan, usageThisMonthCents, capCents, grace, welcome, isDemo } = loaderData;
  const a = actionData as { error?: string } | undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/app/settings" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Settings</Link>
        <h1 className="text-2xl font-display font-semibold">Billing</h1>
        <p className="text-sm text-charcoal-soft">Your plan, your usage, and how you pay us — all in plain sight.</p>
      </div>

      {a?.error && <p className="rounded-2xl bg-terracotta/15 text-terracotta-deep px-4 py-2.5 font-semibold">{a.error}</p>}
      {welcome && state.methodOnFile && (
        <p className="rounded-2xl bg-meadow/15 text-meadow-deep px-4 py-2.5 font-semibold">
          You're all set — thank you for supporting the work. 💚
        </p>
      )}

      <section className="rounded-blob bg-white shadow-soft p-6 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">Your plan</h2>
          <span className="rounded-full bg-sunflower-soft px-3 py-1 text-sm font-semibold">{plan.label}</span>
        </div>
        <p className="text-sm text-charcoal-soft">
          {plan.perAdoptionCents > 0
            ? `${fmtCents(plan.monthlyCents)}/month plus ${fmtCents(plan.perAdoptionCents)} per adoption — capped at ${fmtCents(capCents)}/month, so you never pay more than the flat tier.`
            : `${fmtCents(plan.monthlyCents)}/month flat — unlimited adoptions.`}
        </p>
        {plan.perAdoptionCents > 0 && (
          <div className="mt-2 rounded-2xl bg-cream p-4">
            <div className="flex justify-between text-sm font-semibold">
              <span>Adoption usage this month</span>
              <span>{fmtCents(usageThisMonthCents)} / {fmtCents(capCents)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-white overflow-hidden">
              <div className="h-full bg-meadow rounded-full" style={{ width: `${Math.min(100, (usageThisMonthCents / capCents) * 100)}%` }} />
            </div>
            {usageThisMonthCents >= capCents && (
              <p className="mt-1.5 text-xs font-semibold text-meadow-deep">Capped for the month — every adoption from here is on us. 🎉</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6 space-y-3">
        <h2 className="font-display font-semibold text-lg">Payment method</h2>
        {!state.live ? (
          <p className="text-sm text-charcoal-soft">
            Online billing isn't switched on yet — you're recording adoptions freely in the meantime.
            Nothing to do here today.
          </p>
        ) : state.methodOnFile ? (
          <>
            <p className="text-sm text-charcoal-soft">
              A payment method is on file{state.status === "past_due" ? " — but your last payment needs attention." : "."} Manage your
              card, download invoices, or change plans anytime.
            </p>
            <Form method="post">
              <input type="hidden" name="intent" value="manage" />
              <button className="rounded-full bg-meadow text-white px-5 py-2.5 text-sm font-display font-semibold shadow-soft">
                Manage billing →
              </button>
            </Form>
          </>
        ) : (
          <>
            <p className="text-sm text-charcoal-soft">
              Your first {grace} adoptions are on us{state.graceRemaining > 0 ? ` — ${state.graceRemaining} still free` : ""}. Add a
              payment method to keep recording after that. There's nothing to pay until your monthly cycle, and you can
              cancel anytime.
            </p>
            <Form method="post">
              <input type="hidden" name="intent" value="add-method" />
              <button
                disabled={isDemo}
                className="rounded-full bg-sunflower px-6 py-3 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow disabled:opacity-50"
              >
                Add a payment method
              </button>
            </Form>
            {state.gated && (
              <p className="text-sm font-semibold text-terracotta-deep">
                You've used your free adoptions — add a method above to record the next one.
              </p>
            )}
          </>
        )}
      </section>

      <p className="text-xs text-charcoal-soft">
        Recording an adoption is always what powers your follow-up emails, outcome stats, and grant numbers — the fee is
        tiny by design and capped so it's never a reason to skip it. Questions? <Link to="/app/help/pricing-billing" className="font-semibold text-meadow-deep hover:underline">Read the billing guide</Link> or <Link to="/contact" className="font-semibold text-meadow-deep hover:underline">write to us</Link>.
      </p>
    </div>
  );
}
