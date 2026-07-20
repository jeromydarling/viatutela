import { Form, redirect } from "react-router";
import type { Route } from "./+types/donations";
import { requireUser } from "../../lib/auth.server";
import { emitEvent } from "../../../workers/lib/integrations";
import { newId } from "../../../workers/lib/ids";
import { sendAppEmail } from "../../../workers/lib/email";
import {
  accountChargesEnabled,
  createAccountLink,
  createExpressAccount,
  stripeAvailable,
} from "../../../workers/lib/stripe";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Donations — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const [donations, campaigns, totals, topDonors, contacts, orgRow] = await Promise.all([
    env.DB.prepare(
      `SELECT d.*, c.name contact_name, cp.name campaign_name
       FROM donations d
       LEFT JOIN contacts c ON c.id = d.contact_id
       LEFT JOIN campaigns cp ON cp.id = d.campaign_id
       WHERE d.org_id = ? ORDER BY d.date DESC, d.created_at DESC LIMIT 100`,
    ).bind(user.org_id).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT cp.*, COALESCE((SELECT SUM(amount) FROM donations d WHERE d.campaign_id = cp.id), 0) raised
       FROM campaigns cp WHERE cp.org_id = ? ORDER BY cp.active DESC, cp.created_at DESC`,
    ).bind(user.org_id).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount),0) all_time,
        COALESCE(SUM(CASE WHEN date >= date('now','-30 days') THEN amount END), 0) last30,
        COALESCE(SUM(CASE WHEN date >= date('now','start of year') THEN amount END), 0) ytd
       FROM donations WHERE org_id = ?`,
    ).bind(user.org_id).first<{ all_time: number; last30: number; ytd: number }>(),
    env.DB.prepare(
      `SELECT COALESCE(c.name, d.donor_name, 'Anonymous friend') donor, SUM(d.amount) total
       FROM donations d LEFT JOIN contacts c ON c.id = d.contact_id
       WHERE d.org_id = ? GROUP BY donor ORDER BY total DESC LIMIT 5`,
    ).bind(user.org_id).all<{ donor: string; total: number }>(),
    env.DB.prepare(`SELECT id, name FROM contacts WHERE org_id = ? ORDER BY name LIMIT 500`)
      .bind(user.org_id).all<{ id: string; name: string }>(),
    env.DB.prepare(`SELECT slug, stripe_account_id, stripe_charges_enabled FROM orgs WHERE id = ?`)
      .bind(user.org_id).first<{ slug: string; stripe_account_id: string | null; stripe_charges_enabled: number }>(),
  ]);

  // back from Stripe onboarding: check status once so the card flips to
  // "live" without an extra click
  let chargesEnabled = Boolean(orgRow?.stripe_charges_enabled);
  if (
    new URL(request.url).searchParams.has("stripe_return") &&
    orgRow?.stripe_account_id &&
    !chargesEnabled &&
    stripeAvailable(env)
  ) {
    try {
      chargesEnabled = await accountChargesEnabled(env, orgRow.stripe_account_id);
      if (chargesEnabled) {
        await env.DB.prepare(`UPDATE orgs SET stripe_charges_enabled = 1 WHERE id = ?`)
          .bind(user.org_id)
          .run();
      }
    } catch {
      // Stripe hiccup — the "Check status" button covers it
    }
  }
  return {
    donations: donations.results,
    campaigns: campaigns.results,
    totals: totals ?? { all_time: 0, last30: 0, ytd: 0 },
    topDonors: topDonors.results,
    contacts: contacts.results,
    giving: {
      stripeReady: stripeAvailable(env),
      connected: Boolean(orgRow?.stripe_account_id),
      live: chargesEnabled,
      donateUrl: `${new URL(request.url).origin}/donate/${orgRow?.slug}`,
      isDemo: Boolean(user.demo),
    },
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const str = (k: string) => String(f.get(k) ?? "").trim() || null;

  if (intent === "stripe-onboard" || intent === "stripe-refresh") {
    if (user.demo) return { error: "The demo can look but not connect a real Stripe account. 🌻" };
    if (!stripeAvailable(env)) return { error: "Stripe isn't configured on the platform yet." };
    const org = await env.DB.prepare(`SELECT name, email, stripe_account_id FROM orgs WHERE id = ?`)
      .bind(user.org_id)
      .first<{ name: string; email: string | null; stripe_account_id: string | null }>();
    if (!org) return { error: "Organization not found." };
    try {
      if (intent === "stripe-refresh" && org.stripe_account_id) {
        const enabled = await accountChargesEnabled(env, org.stripe_account_id);
        await env.DB.prepare(`UPDATE orgs SET stripe_charges_enabled = ? WHERE id = ?`)
          .bind(enabled ? 1 : 0, user.org_id)
          .run();
        return enabled
          ? { ok: "You're live! Share your donate page far and wide. 💚" }
          : { error: "Stripe says onboarding isn't finished yet — tap “Finish Stripe setup” to continue where you left off." };
      }
      let accountId = org.stripe_account_id;
      if (!accountId) {
        accountId = await createExpressAccount(env, org.name, org.email);
        await env.DB.prepare(`UPDATE orgs SET stripe_account_id = ? WHERE id = ?`)
          .bind(accountId, user.org_id)
          .run();
      }
      const base = new URL(request.url).origin;
      const link = await createAccountLink(
        env,
        accountId,
        `${base}/app/donations`,
        `${base}/app/donations?stripe_return=1`,
      );
      return redirect(link);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Stripe had a hiccup — try again in a minute." };
    }
  }

  if (intent === "record") {
    const amount = Number(f.get("amount"));
    if (!isFinite(amount) || amount <= 0) return { error: "The amount needs to be a positive number." };
    const contactId = str("contact_id");
    const donationId = newId("dn");
    await env.DB.prepare(
      `INSERT INTO donations (id, org_id, contact_id, campaign_id, donor_name, email, amount, method, note, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))`,
    )
      .bind(
        donationId, user.org_id, contactId, str("campaign_id"),
        contactId ? null : str("donor_name"), str("email"), amount,
        str("method"), str("note"), str("date"),
      )
      .run();
    ctx.waitUntil(
      emitEvent(env, ctx, user.org_id, "donation.created", {
        id: donationId,
        contact_id: contactId,
        donor_name: contactId ? null : str("donor_name"),
        email: str("email"),
        amount,
        method: str("method"),
        date: str("date") ?? new Date().toISOString().slice(0, 10),
      }),
    );
    let receiptEmail = str("email");
    let donorName = str("donor_name");
    if (contactId) {
      const c = await env.DB.prepare(`SELECT name, email, roles FROM contacts WHERE id = ?`)
        .bind(contactId)
        .first<{ name: string; email: string | null; roles: string | null }>();
      receiptEmail = receiptEmail ?? c?.email ?? null;
      donorName = donorName ?? c?.name ?? null;
      const roles = new Set((c?.roles ?? "").split(",").filter(Boolean));
      if (!roles.has("donor")) {
        roles.add("donor");
        await env.DB.prepare(`UPDATE contacts SET roles = ? WHERE id = ?`).bind([...roles].join(","), contactId).run();
      }
    }
    if (receiptEmail) {
      ctx.waitUntil(
        sendAppEmail(env, {
          to: receiptEmail,
          subject: `Thank you from ${user.org_name} 💛`,
          heading: "Thank you for your generosity",
          paragraphs: [
            `${donorName ?? "Friend"}, your gift of ${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} to ${user.org_name} has been received with gratitude.`,
            `It goes straight to the animals — Tutela doesn't take a cent.`,
            `Keep this note for your records.`,
          ],
        }),
      );
    }
    return { ok: "Thank you for their generosity — recorded. It goes straight to the animals." };
  }

  if (intent === "add-campaign") {
    const name = str("name");
    if (!name) return { error: "Give the campaign a name." };
    await env.DB.prepare(
      `INSERT INTO campaigns (id, org_id, name, goal, description) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(newId("cp"), user.org_id, name, f.get("goal") ? Number(f.get("goal")) : null, str("description"))
      .run();
    return { ok: "Campaign created." };
  }

  if (intent === "toggle-campaign") {
    await env.DB.prepare(
      `UPDATE campaigns SET active = 1 - active WHERE id = ? AND org_id = ?`,
    ).bind(str("campaign_id"), user.org_id).run();
    return null;
  }
  return null;
}

const inputCls =
  "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Donations({ loaderData, actionData }: Route.ComponentProps) {
  const { donations, campaigns, totals, topDonors, contacts, giving } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-semibold">Donations & fundraising</h1>

      <p className="rounded-2xl bg-sky/15 text-sky-deep px-4 py-3 text-sm font-semibold">
        Online card donations via Stripe are coming — the Stripe connection just needs to be
        authorized in your Claude connector settings. Until then, record gifts here; every
        report and campaign total already works.
      </p>

      {(actionData?.ok || actionData?.error) && (
        <p className={`rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}>
          {actionData.error ?? actionData.ok}
        </p>
      )}

      <section className="rounded-blob bg-white shadow-soft p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg">Online giving {giving.live && "· live 💚"}</h2>
            <p className="text-sm text-charcoal-soft max-w-xl">
              {giving.live
                ? "Donors can give one-time or monthly on your donate page. You're the recipient of record — receipts carry your name, payouts go straight to your bank."
                : giving.connected
                  ? "Your Stripe account is created but onboarding isn't finished — pick up where you left off."
                  : "Take one-time and monthly donations on your own page. Donors are asked to cover the card fees and Tutela's 2% platform fee, so gifts reach you whole."}
            </p>
            {giving.live && (
              <a href={giving.donateUrl} className="mt-1 inline-block text-sm font-semibold text-meadow-deep hover:underline break-all">
                {giving.donateUrl} ↗
              </a>
            )}
          </div>
          <div className="flex gap-2">
            {!giving.stripeReady && !giving.isDemo ? (
              <span className="text-sm font-semibold text-charcoal-soft rounded-full bg-sunflower-soft px-4 py-2">
                Coming online soon — Stripe setup in progress
              </span>
            ) : giving.live ? (
              <Form method="post">
                <input type="hidden" name="intent" value="stripe-refresh" />
                <button className="rounded-full bg-cream px-4 py-2 text-sm font-semibold hover:bg-sunflower-soft">Re-check status</button>
              </Form>
            ) : (
              <>
                <Form method="post">
                  <input type="hidden" name="intent" value="stripe-onboard" />
                  <button className="rounded-full bg-meadow text-white px-5 py-2.5 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow">
                    {giving.connected ? "Finish Stripe setup" : "Set up online giving"}
                  </button>
                </Form>
                {giving.connected && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="stripe-refresh" />
                    <button className="rounded-full bg-cream px-4 py-2 text-sm font-semibold hover:bg-sunflower-soft">Check status</button>
                  </Form>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-4">
        {[
          ["last 30 days", totals.last30],
          ["this year", totals.ytd],
          ["all time", totals.all_time],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-blob bg-white shadow-soft p-5 text-center">
            <div className="text-2xl font-display font-bold text-meadow-deep">{fmt(n as number)}</div>
            <div className="text-xs font-semibold text-charcoal-soft">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Form method="post" className="rounded-blob bg-white shadow-soft p-6 space-y-3">
          <input type="hidden" name="intent" value="record" />
          <h2 className="font-display font-semibold text-lg">Record a gift</h2>
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount $ *" className={`${inputCls} w-full`} />
          <select name="contact_id" className={`${inputCls} w-full`}>
            <option value="">Donor from your people…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input name="donor_name" placeholder="…or a new donor's name" className={`${inputCls} w-full`} />
          <input name="email" type="email" placeholder="Donor email" className={`${inputCls} w-full`} />
          <div className="flex gap-2">
            <select name="method" className={`${inputCls} flex-1`}>
              {["cash", "check", "card", "online", "in-kind", "other"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input name="date" type="date" className={inputCls} />
          </div>
          <select name="campaign_id" className={`${inputCls} w-full`}>
            <option value="">General fund</option>
            {campaigns.filter((c) => c.active).map((c) => (
              <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
            ))}
          </select>
          <input name="note" placeholder="Note" className={`${inputCls} w-full`} />
          <button className="w-full rounded-full bg-sunflower px-5 py-2.5 font-display font-semibold shadow-soft">
            Record with gratitude
          </button>
        </Form>

        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-lg">Campaigns</h2>
            {campaigns.length === 0 && (
              <p className="mt-2 text-sm text-charcoal-soft">No campaigns yet — start one below.</p>
            )}
            <div className="mt-3 space-y-4">
              {campaigns.map((cp) => {
                const goal = Number(cp.goal ?? 0);
                const raised = Number(cp.raised ?? 0);
                const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null;
                return (
                  <div key={String(cp.id)} className={cp.active ? "" : "opacity-50"}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{String(cp.name)}</span>
                      <span>
                        {fmt(raised)}{goal > 0 && ` of ${fmt(goal)}`}
                        <Form method="post" className="inline ml-3">
                          <input type="hidden" name="intent" value="toggle-campaign" />
                          <input type="hidden" name="campaign_id" value={String(cp.id)} />
                          <button className="text-xs font-semibold text-charcoal-soft hover:underline">
                            {cp.active ? "pause" : "resume"}
                          </button>
                        </Form>
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-1 h-3 rounded-full bg-cream overflow-hidden">
                        <div className="h-full bg-meadow" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Form method="post" className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="intent" value="add-campaign" />
              <input name="name" required placeholder="New campaign name" className={`${inputCls} flex-1 min-w-40`} />
              <input name="goal" type="number" min="0" step="1" placeholder="Goal $" className={`${inputCls} w-28`} />
              <button className="rounded-full bg-meadow text-white px-4 py-2 text-sm font-semibold">Create</button>
            </Form>
          </section>

          <section className="rounded-blob bg-white shadow-soft p-6">
            <h2 className="font-display font-semibold text-lg">Most generous friends</h2>
            <ul className="mt-2 divide-y divide-cream text-sm">
              {topDonors.map((d) => (
                <li key={d.donor} className="py-2 flex justify-between">
                  <span>{d.donor}</span>
                  <span className="font-semibold">{fmt(d.total)}</span>
                </li>
              ))}
              {topDonors.length === 0 && <li className="py-2 text-charcoal-soft">No gifts recorded yet.</li>}
            </ul>
          </section>
        </div>
      </div>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Recent gifts</h2>
        {donations.length === 0 ? (
          <p className="mt-2 text-charcoal-soft text-sm">Gifts you record will appear here.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-charcoal-soft">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Donor</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Campaign</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={String(d.id)} className="border-t border-cream">
                    <td className="py-2 pr-4 whitespace-nowrap">{String(d.date)}</td>
                    <td className="py-2 pr-4">{String(d.contact_name ?? d.donor_name ?? "Anonymous friend")}</td>
                    <td className="py-2 pr-4 font-semibold">{fmt(Number(d.amount))}</td>
                    <td className="py-2 pr-4">{String(d.method ?? "")}</td>
                    <td className="py-2 pr-4">{String(d.campaign_name ?? "General")}</td>
                    <td className="py-2">{String(d.note ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
