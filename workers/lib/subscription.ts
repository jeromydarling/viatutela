/**
 * Platform subscription billing — how a shelter pays Tutela.
 *
 * This is deliberately SEPARATE from Stripe Connect (workers/lib/stripe.ts),
 * which is how shelters RECEIVE donations. A shelter can take donations
 * without a subscription card, or subscribe without ever taking a
 * donation — the two never gate each other.
 *
 * Billing gate: a shelter records its first FREE_ADOPTION_GRACE adoptions
 * for free while it evaluates. After that, recording continues only once
 * a payment method is on file (the standard, unresented SaaS pattern —
 * "you're a paying customer", never "you connected our other product").
 *
 * DARK BY DEFAULT: without STRIPE_SECRET_KEY the gate always allows and
 * every billing surface shows a friendly "coming soon". Nothing is ever
 * blocked until platform billing is switched on with the keys.
 */

import { PLANS } from "./pricing";
import { StripeError, stripeAvailable, stripeRequest } from "./stripe";

/** Adoptions a new shelter can record before a card is required. */
export const FREE_ADOPTION_GRACE = 5;

export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

export interface BillingState {
  live: boolean; // platform billing is switched on (keys present)
  status: SubscriptionStatus;
  methodOnFile: boolean;
  plan: string;
  adoptionsRecorded: number;
  graceRemaining: number;
  gated: boolean; // true when the next adoption would be blocked
}

interface OrgBillingRow {
  plan: string;
  demo: number;
  stripe_customer_id: string | null;
  subscription_status: string;
  billing_method_on_file: number;
}

/**
 * The gate every adoption-recording path consults BEFORE inserting.
 * Returns { allowed: true } whenever billing is dark, the org is the
 * demo, a card is on file, or the org is still inside its free grace.
 */
export async function billingGate(
  env: Env,
  orgId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!stripeAvailable(env)) return { allowed: true };
  const org = await env.DB.prepare(
    `SELECT plan, demo, stripe_customer_id, subscription_status, billing_method_on_file FROM orgs WHERE id = ?`,
  )
    .bind(orgId)
    .first<OrgBillingRow>();
  if (!org || org.demo) return { allowed: true };
  if (org.billing_method_on_file) return { allowed: true };

  const used = await env.DB.prepare(`SELECT COUNT(*) n FROM adoptions WHERE org_id = ?`)
    .bind(orgId)
    .first<{ n: number }>();
  if ((used?.n ?? 0) < FREE_ADOPTION_GRACE) return { allowed: true };

  return {
    allowed: false,
    reason:
      "You've recorded your first few adoptions on us. To keep recording, add a payment method in Settings → Billing — it takes a minute, and there's nothing to pay until your monthly cycle.",
  };
}

export async function billingState(env: Env, orgId: string): Promise<BillingState> {
  const live = stripeAvailable(env);
  const org = await env.DB.prepare(
    `SELECT plan, demo, stripe_customer_id, subscription_status, billing_method_on_file FROM orgs WHERE id = ?`,
  )
    .bind(orgId)
    .first<OrgBillingRow>();
  const used = await env.DB.prepare(`SELECT COUNT(*) n FROM adoptions WHERE org_id = ?`)
    .bind(orgId)
    .first<{ n: number }>();
  const adoptionsRecorded = used?.n ?? 0;
  const methodOnFile = Boolean(org?.billing_method_on_file);
  const graceRemaining = Math.max(0, FREE_ADOPTION_GRACE - adoptionsRecorded);
  return {
    live,
    status: (org?.subscription_status as SubscriptionStatus) ?? "none",
    methodOnFile,
    plan: org?.plan ?? "starter",
    adoptionsRecorded,
    graceRemaining,
    gated: live && !methodOnFile && graceRemaining === 0 && !org?.demo,
  };
}

// ---------- Stripe customer + subscription checkout ----------

async function ensureCustomer(env: Env, orgId: string, orgName: string, email: string | null): Promise<string> {
  const org = await env.DB.prepare(`SELECT stripe_customer_id FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first<{ stripe_customer_id: string | null }>();
  if (org?.stripe_customer_id) return org.stripe_customer_id;
  const customer = await stripeRequest<{ id: string }>(env, "POST", "/customers", {
    name: orgName.slice(0, 100),
    "metadata[org_id]": orgId,
    "metadata[platform]": "tutela",
    ...(email ? { email } : {}),
  });
  await env.DB.prepare(`UPDATE orgs SET stripe_customer_id = ? WHERE id = ?`)
    .bind(customer.id, orgId)
    .run();
  return customer.id;
}

/**
 * A Checkout Session in subscription mode for the org's plan. Uses inline
 * price_data so no Price objects need pre-creating in the dashboard — the
 * monthly amount comes straight from PLANS. Starter's per-adoption usage
 * stays on our internal ledger (workers/lib/billing.ts) and syncs later.
 */
export async function createSubscriptionCheckout(
  env: Env,
  args: { orgId: string; orgName: string; email: string | null; origin: string },
): Promise<string> {
  const plan = await env.DB.prepare(`SELECT plan FROM orgs WHERE id = ?`)
    .bind(args.orgId)
    .first<{ plan: string }>();
  const planDef = PLANS[plan?.plan ?? "starter"] ?? PLANS.starter;
  const customerId = await ensureCustomer(env, args.orgId, args.orgName, args.email);

  const session = await stripeRequest<{ url: string }>(env, "POST", "/checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": planDef.monthlyCents,
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `Tutela ${planDef.label}`,
    success_url: `${args.origin}/app/settings/billing?welcome=1`,
    cancel_url: `${args.origin}/app/settings/billing`,
    "subscription_data[metadata][org_id]": args.orgId,
    "subscription_data[metadata][kind]": "platform_subscription",
    "metadata[org_id]": args.orgId,
    "metadata[kind]": "platform_subscription",
  });
  return session.url;
}

/** Billing portal so shelters manage card, invoices, and cancellation themselves. */
export async function createBillingPortal(env: Env, orgId: string, returnUrl: string): Promise<string> {
  const org = await env.DB.prepare(`SELECT stripe_customer_id FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first<{ stripe_customer_id: string | null }>();
  if (!org?.stripe_customer_id) throw new StripeError(0, "No billing account yet — add a payment method first.");
  const portal = await stripeRequest<{ url: string }>(env, "POST", "/billing_portal/sessions", {
    customer: org.stripe_customer_id,
    return_url: returnUrl,
  });
  return portal.url;
}

// ---------- webhook application (called from the shared /stripe/webhook) ----------

/**
 * Handle a platform-subscription webhook event. Returns true if it was a
 * platform-billing event (so the donation handler can skip it). Connected
 * account events carry event.account; platform events do not — and we tag
 * ours with metadata.kind = "platform_subscription" as a second guard.
 */
export async function handleSubscriptionEvent(
  env: Env,
  event: { type?: string; account?: string; data?: { object?: Record<string, any> } },
): Promise<boolean> {
  if (event.account) return false; // connected-account event — not platform billing
  const obj = event.data?.object ?? {};

  if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
    const orgId = String(obj.metadata?.org_id ?? "");
    if (obj.metadata?.kind !== "platform_subscription" || !orgId) return false;
    await env.DB.prepare(
      `UPDATE orgs SET billing_method_on_file = 1, subscription_status = 'active',
         stripe_customer_id = COALESCE(stripe_customer_id, ?), stripe_subscription_id = ?
       WHERE id = ?`,
    )
      .bind(obj.customer ? String(obj.customer) : null, obj.subscription ? String(obj.subscription) : null, orgId)
      .run();
    return true;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    if (obj.metadata?.kind !== "platform_subscription") return false;
    const orgId = String(obj.metadata?.org_id ?? "");
    if (!orgId) return false;
    const status = mapSubscriptionStatus(String(obj.status ?? ""), event.type);
    await env.DB.prepare(
      `UPDATE orgs SET subscription_status = ?, billing_method_on_file = ? WHERE id = ?`,
    )
      .bind(status, status === "canceled" ? 0 : 1, orgId)
      .run();
    return true;
  }

  return false;
}

function mapSubscriptionStatus(stripeStatus: string, eventType: string): SubscriptionStatus {
  if (eventType === "customer.subscription.deleted") return "canceled";
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "past_due";
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") return "canceled";
  return "active";
}
