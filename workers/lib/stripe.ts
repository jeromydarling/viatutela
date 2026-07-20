/**
 * Stripe Connect for shelter online giving.
 *
 * Model: each shelter gets an Express connected account; donations are
 * direct charges on that account (the shelter is the merchant of record,
 * receipts carry their name) with a platform application fee. Donors can
 * add a clearly-labeled amount that covers card + platform fees so the
 * shelter nets the full gift.
 *
 * Degrades cleanly: without the STRIPE_SECRET_KEY secret, setup UI shows
 * a friendly note and public donate pages fall back to contact info.
 * All money math happens in integer cents.
 */

const API = "https://api.stripe.com/v1";

/** Platform fee: 2% (200 basis points). Disclosed on the donate form. */
export const PLATFORM_FEE_BPS = 200;
/** Standard card pricing used for the fee-cover estimate. */
export const CARD_RATE_BPS = 290;
export const CARD_FIXED_CENTS = 30;

function secrets(env: Env): { key?: string; webhook?: string } {
  const e = env as unknown as { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string };
  return { key: e.STRIPE_SECRET_KEY?.trim() || undefined, webhook: e.STRIPE_WEBHOOK_SECRET?.trim() || undefined };
}

export function stripeAvailable(env: Env): boolean {
  return Boolean(secrets(env).key);
}

export function platformFeeCents(totalCents: number): number {
  return Math.floor((totalCents * PLATFORM_FEE_BPS) / 10_000);
}

/**
 * Extra cents a donor adds so the shelter nets the full base gift after
 * card + platform fees: total = ceil((base + fixed) / (1 - rate - platform)).
 */
export function feeCoverCents(baseCents: number): number {
  const denominator = 1 - CARD_RATE_BPS / 10_000 - PLATFORM_FEE_BPS / 10_000;
  const total = Math.ceil((baseCents + CARD_FIXED_CENTS) / denominator);
  return Math.max(0, total - baseCents);
}

// ---------- REST plumbing (no SDK — form-encoded fetch keeps the worker light) ----------

function encodeForm(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

export class StripeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function stripeRequest<T = Record<string, unknown>>(
  env: Env,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  stripeAccount?: string,
): Promise<T> {
  const { key } = secrets(env);
  if (!key) throw new StripeError(0, "Stripe isn't configured yet (STRIPE_SECRET_KEY).");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;
  const body = method === "POST" ? encodeForm(params ?? {}) : undefined;
  const qs = method === "GET" && params ? `?${encodeForm(params)}` : "";
  const resp = await fetch(`${API}${path}${qs}`, { method, headers, body });
  const data = (await resp.json()) as T & { error?: { message?: string } };
  if (!resp.ok) {
    throw new StripeError(resp.status, data.error?.message ?? `Stripe error (HTTP ${resp.status})`);
  }
  return data;
}

// ---------- Connect onboarding ----------

export async function createExpressAccount(env: Env, orgName: string, email: string | null): Promise<string> {
  const account = await stripeRequest<{ id: string }>(env, "POST", "/accounts", {
    type: "express",
    country: "US",
    "capabilities[card_payments][requested]": "true",
    "capabilities[transfers][requested]": "true",
    "business_profile[name]": orgName.slice(0, 100),
    "metadata[platform]": "tutela",
    ...(email ? { email } : {}),
  });
  return account.id;
}

export async function createAccountLink(
  env: Env,
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<string> {
  const link = await stripeRequest<{ url: string }>(env, "POST", "/account_links", {
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function accountChargesEnabled(env: Env, accountId: string): Promise<boolean> {
  const account = await stripeRequest<{ charges_enabled?: boolean }>(env, "GET", `/accounts/${accountId}`);
  return Boolean(account.charges_enabled);
}

// ---------- donation checkout ----------

export interface DonationCheckoutInput {
  accountId: string;
  orgId: string;
  orgName: string;
  slug: string;
  baseCents: number; // the gift itself
  coverFees: boolean;
  monthly: boolean;
  origin: string;
}

export async function createDonationCheckout(env: Env, input: DonationCheckoutInput): Promise<string> {
  const cover = input.coverFees ? feeCoverCents(input.baseCents) : 0;
  const totalCents = input.baseCents + cover;
  const label = input.monthly
    ? `Monthly gift to ${input.orgName}`
    : `Donation to ${input.orgName}`;

  const common: Record<string, string | number> = {
    mode: input.monthly ? "subscription" : "payment",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": totalCents,
    "line_items[0][price_data][product_data][name]": label,
    success_url: `${input.origin}/donate/${input.slug}?thanks=1`,
    cancel_url: `${input.origin}/donate/${input.slug}`,
    "metadata[org_id]": input.orgId,
    "metadata[base_cents]": input.baseCents,
    "metadata[cover_cents]": cover,
    "metadata[monthly]": input.monthly ? 1 : 0,
  };

  const params: Record<string, string | number> = { ...common };
  if (input.monthly) {
    params["line_items[0][price_data][recurring][interval]"] = "month";
    params["subscription_data[application_fee_percent]"] = PLATFORM_FEE_BPS / 100;
    params["subscription_data[metadata][org_id]"] = input.orgId;
    params["subscription_data[metadata][base_cents]"] = input.baseCents;
    params["subscription_data[metadata][cover_cents]"] = cover;
  } else {
    params.submit_type = "donate";
    params["payment_intent_data[application_fee_amount]"] = platformFeeCents(totalCents);
  }

  const session = await stripeRequest<{ url: string }>(env, "POST", "/checkout/sessions", params, input.accountId);
  return session.url;
}

// ---------- webhook verification (Stripe-Signature v1 scheme) ----------

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyStripeSignature(
  env: Env,
  payload: string,
  header: string | null,
  toleranceSeconds = 300,
  nowMs = Date.now(),
): Promise<boolean> {
  const { webhook } = secrets(env);
  if (!webhook || !header) return false;
  let timestamp = "";
  const candidates: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s?.trim() ?? "");
    if (k === "t") timestamp = v;
    if (k === "v1" && /^[a-f0-9]{64}$/.test(v)) candidates.push(v);
  }
  if (!timestamp || !candidates.length) return false;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!isFinite(age) || age > toleranceSeconds) return false;
  const expected = await hmacHex(webhook, `${timestamp}.${payload}`);
  return candidates.some((c) => {
    if (c.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= c.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}
