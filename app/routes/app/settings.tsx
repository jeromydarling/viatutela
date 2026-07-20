import { Form, Link } from "react-router";
import type { Route } from "./+types/settings";
import { requireUser } from "../../lib/auth.server";
import { US_STATES, isUsState } from "../../../workers/lib/adopt-alerts";
import { newId, newToken } from "../../../workers/lib/ids";
import { normalizePhone } from "../../../workers/lib/sms";
import { seatLimit, PLANS } from "../../../workers/lib/pricing";
import { sendAppEmail } from "../../../workers/lib/email";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Settings — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const [org, locations, team] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, slug, plan, about, website, email, phone, address, state, sms_number FROM orgs WHERE id = ?`,
    ).bind(user.org_id).first<Record<string, string | null>>(),
    env.DB.prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM animals a WHERE a.location_id = l.id AND a.status NOT IN ('adopted','deceased','transferred')) in_care
       FROM locations l WHERE l.org_id = ? ORDER BY l.active DESC, l.name`,
    ).bind(user.org_id).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT id, email, name, invite_token IS NOT NULL AND password_hash IS NULL invited, created_at
       FROM users WHERE org_id = ? ORDER BY created_at`,
    ).bind(user.org_id).all<{ id: string; email: string; name: string | null; invited: number; created_at: string }>(),
  ]);
  const origin = new URL(request.url).origin;
  return {
    org: org!,
    origin,
    locations: locations.results,
    team: team.results,
    seats: seatLimit(String(org?.plan ?? "starter")),
    myUserId: user.user_id,
    isDemo: Boolean(user.demo),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "org");
  const str = (k: string) => String(f.get(k) ?? "").trim() || null;

  if (intent === "add-location") {
    const name = str("location_name");
    if (!name) return { error: "The location needs a name." };
    await env.DB.prepare(
      `INSERT INTO locations (id, org_id, name, address) VALUES (?, ?, ?, ?)`,
    )
      .bind(newId("lc"), user.org_id, name, str("location_address"))
      .run();
    return { ok: `${name} added.` };
  }

  if (intent === "toggle-location") {
    await env.DB.prepare(`UPDATE locations SET active = 1 - active WHERE id = ? AND org_id = ?`)
      .bind(str("location_id"), user.org_id)
      .run();
    return null;
  }

  if (intent === "invite-member") {
    if (user.demo) return { error: "The demo can't send invites — but this is exactly how your real team would join." };
    const email = String(f.get("member_email") ?? "").trim().toLowerCase();
    const memberName = str("member_name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "That email doesn't look right." };
    const count = await env.DB.prepare(`SELECT COUNT(*) n FROM users WHERE org_id = ?`)
      .bind(user.org_id)
      .first<{ n: number }>();
    const seats = seatLimit(user.plan);
    if ((count?.n ?? 0) >= seats) {
      return { error: `Your ${PLANS[user.plan]?.label ?? "current"} plan includes ${seats} seats — they're all filled. A bigger plan adds more.` };
    }
    const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
    if (existing) return { error: "That email already has a Tutela account." };
    const token = newToken();
    await env.DB.prepare(
      `INSERT INTO users (id, org_id, email, name, invite_token, invited_by) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId("u"), user.org_id, email, memberName, token, user.user_id)
      .run();
    const origin = new URL(request.url).origin;
    ctx.waitUntil(
      sendAppEmail(env, {
        to: email,
        subject: `${user.user_name ?? "A teammate"} invited you to ${user.org_name} on Tutela 🌻`,
        heading: `Come join ${user.org_name}`,
        paragraphs: [
          `${user.user_name ?? user.email} added you to ${user.org_name}'s workspace on Tutela — the place where the whole team manages animals, adoptions, and everything around them.`,
          `Tap the button to choose a password and step inside. This link is yours alone; if you weren't expecting it, you can simply ignore it.`,
        ],
        cta: { label: "Join the team", url: `${origin}/join/${token}` },
      }).then(() => {}),
    );
    return {
      ok: `Invite sent to ${email} — their seat is reserved. You can also hand them the link directly:`,
      inviteLink: `${origin}/join/${token}`,
    };
  }

  if (intent === "revoke-invite") {
    await env.DB.prepare(
      `DELETE FROM users WHERE id = ? AND org_id = ? AND invite_token IS NOT NULL AND password_hash IS NULL`,
    )
      .bind(str("member_id"), user.org_id)
      .run();
    return { ok: "Invite withdrawn." };
  }

  if (intent === "remove-member") {
    const memberId = str("member_id");
    if (memberId === user.user_id) return { error: "You can't remove yourself — ask a teammate to do it." };
    const member = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND org_id = ?`)
      .bind(memberId, user.org_id)
      .first();
    if (!member) return { error: "That teammate is already gone." };
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(memberId),
      env.DB.prepare(`DELETE FROM users WHERE id = ? AND org_id = ?`).bind(memberId, user.org_id),
    ]);
    return { ok: "Teammate removed — their sessions are signed out everywhere." };
  }

  const name = str("name");
  if (!name) return { error: "Your organization needs a name." };
  const smsRaw = str("sms_number");
  const smsNumber = smsRaw ? normalizePhone(smsRaw) : null;
  if (smsRaw && !smsNumber) return { error: "That SMS number doesn't look right — use a full number like (555) 010-2211." };
  const stateRaw = str("state")?.toUpperCase() ?? "";
  const state = stateRaw && isUsState(stateRaw) ? stateRaw : null;
  await env.DB.prepare(
    `UPDATE orgs SET name=?, about=?, website=?, email=?, phone=?, address=?, state=?, sms_number=? WHERE id=?`,
  )
    .bind(name, str("about"), str("website"), str("email"), str("phone"), str("address"), state, smsNumber, user.org_id)
    .run();
  return { ok: "Saved." };
}

const inputCls =
  "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { org, origin, locations, team, seats, myUserId, isDemo } = loaderData;
  const inviteLink = (actionData as { inviteLink?: string } | undefined)?.inviteLink;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-display font-semibold">Settings</h1>

      {(actionData?.ok || actionData?.error) && (
        <p className={`rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}>
          {actionData.error ?? actionData.ok}
        </p>
      )}

      <Form method="post" className="rounded-blob bg-white shadow-soft p-6 space-y-4">
        <h2 className="font-display font-semibold text-lg">Your organization</h2>
        <label className="block">
          <span className="font-semibold text-sm">Name *</span>
          <input name="name" required defaultValue={org.name ?? ""} className={inputCls} />
        </label>
        <label className="block">
          <span className="font-semibold text-sm">About (shown on your adoption page)</span>
          <textarea name="about" rows={3} defaultValue={org.about ?? ""} className={inputCls} />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="font-semibold text-sm">Public email</span>
            <input name="email" type="email" defaultValue={org.email ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="font-semibold text-sm">Phone</span>
            <input name="phone" defaultValue={org.phone ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="font-semibold text-sm">Website</span>
            <input name="website" defaultValue={org.website ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="font-semibold text-sm">Address</span>
            <input name="address" defaultValue={org.address ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="font-semibold text-sm">State</span>
            <select name="state" defaultValue={(org as Record<string, string | null>).state ?? ""} className={inputCls}>
              <option value="">Choose your state…</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-charcoal-soft">Powers the “near you” filter on Tutela's cross-shelter adoption search.</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="font-semibold text-sm">📱 Text alerts number</span>
            <input name="sms_number" defaultValue={(org as Record<string, string | null>).sms_number ?? ""} placeholder="(555) 010-2211 — new applications text this phone" className={inputCls} />
            <span className="text-xs text-charcoal-soft">Delivery starts once Twilio is connected on the platform; adopters with a phone number also get a text when they're approved.</span>
          </label>
        </div>
        <button className="rounded-full bg-meadow text-white px-6 py-2.5 font-display font-semibold shadow-soft">
          Save
        </button>
      </Form>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-semibold text-lg">Your team</h2>
          <span className="rounded-full bg-sky/20 text-sky-deep text-xs font-semibold px-2 py-0.5">
            {team.length} of {seats} seats
          </span>
        </div>
        <ul className="mt-3 divide-y divide-cream text-sm">
          {team.map((m) => (
            <li key={m.id} className="py-2.5 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{m.name ?? m.email}</span>
              {m.name && <span className="text-charcoal-soft">{m.email}</span>}
              {m.id === myUserId && (
                <span className="rounded-full bg-sunflower-soft text-xs font-semibold px-2 py-0.5">you</span>
              )}
              {Boolean(m.invited) && (
                <span className="rounded-full bg-charcoal/10 text-xs font-semibold px-2 py-0.5">invited — hasn't joined yet</span>
              )}
              <span className="flex-1" />
              {m.id !== myUserId && (
                <Form method="post">
                  <input type="hidden" name="intent" value={m.invited ? "revoke-invite" : "remove-member"} />
                  <input type="hidden" name="member_id" value={m.id} />
                  <button className="text-xs font-semibold text-terracotta-deep hover:underline">
                    {m.invited ? "withdraw invite" : "remove"}
                  </button>
                </Form>
              )}
            </li>
          ))}
        </ul>
        {inviteLink && (
          <p className="mt-2 rounded-2xl bg-cream px-3 py-2 text-xs font-semibold break-all">
            🔗 {inviteLink}
          </p>
        )}
        {team.length < seats ? (
          <Form method="post" className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="invite-member" />
            <input name="member_name" placeholder="Name (optional)" className={`${inputCls} mt-0 flex-1 min-w-32`} />
            <input name="member_email" type="email" required placeholder="teammate@yourrescue.org" className={`${inputCls} mt-0 flex-1 min-w-48`} />
            <button className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-semibold" disabled={isDemo}>
              Send invite
            </button>
          </Form>
        ) : (
          <p className="mt-3 text-sm text-charcoal-soft">
            All seats are filled. Need more hands? The Rescue plan includes 10 and Shelter Pro 25.
          </p>
        )}
        <p className="mt-2 text-xs text-charcoal-soft">
          Teammates get full access to this workspace: animals, applications, website, everything.
          {isDemo && " (Demo accounts can look but not invite.)"}
        </p>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6 space-y-3">
        <h2 className="font-display font-semibold text-lg">Your public links</h2>
        <div className="text-sm space-y-2">
          <p>
            <span className="font-semibold">Adoption page:</span>{" "}
            <a href={`/adopt/${org.slug}`} className="text-meadow-deep font-semibold hover:underline">
              {origin}/adopt/{org.slug}
            </a>
          </p>
          <p>
            <span className="font-semibold">Petfinder-format feed (CSV):</span>{" "}
            <a href={`/api/feeds/${org.slug}/petfinder.csv`} className="text-meadow-deep font-semibold hover:underline">
              {origin}/api/feeds/{org.slug}/petfinder.csv
            </a>
            <span className="block text-charcoal-soft">
              Point Petfinder / Adopt-a-Pet imports at this URL — it always reflects your current adoptable friends.
            </span>
          </p>
        </div>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6 space-y-3">
        <h2 className="font-display font-semibold text-lg">Integrations</h2>
        <p className="text-sm text-charcoal-soft">
          API keys, webhooks for Zapier/Make/n8n, and a calendar feed of volunteer shifts.
        </p>
        <Link
          to="/app/settings/integrations"
          className="inline-block rounded-full bg-sky/20 text-sky-deep px-6 py-3 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow"
        >
          Manage integrations →
        </Link>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6 space-y-3">
        <h2 className="font-display font-semibold text-lg">Own your data</h2>
        <p className="text-sm text-charcoal-soft">
          Everything you've ever entered, in plain CSVs, whenever you want it. No strings, ever.
        </p>
        <a
          href="/api/export.zip"
          className="inline-block rounded-full bg-sunflower px-6 py-3 font-display font-semibold shadow-soft hover:shadow-lift transition-shadow"
        >
          Download everything (.zip)
        </a>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Locations</h2>
        <p className="mt-1 text-sm text-charcoal-soft">
          Buildings, rooms, or partner sites. Assign friends to a location on
          their profile; filter and report by location everywhere.
        </p>
        {locations.length > 0 && (
          <ul className="mt-3 divide-y divide-cream text-sm">
            {locations.map((l) => (
              <li key={String(l.id)} className={`py-2.5 flex items-center gap-3 ${l.active ? "" : "opacity-50"}`}>
                <span className="font-semibold">{String(l.name)}</span>
                <span className="text-charcoal-soft">{String(l.address ?? "")}</span>
                <span className="flex-1" />
                <span className="rounded-full bg-sky/20 text-sky-deep text-xs font-semibold px-2 py-0.5">
                  {Number(l.in_care)} in care
                </span>
                <Form method="post">
                  <input type="hidden" name="intent" value="toggle-location" />
                  <input type="hidden" name="location_id" value={String(l.id)} />
                  <button className="text-xs font-semibold text-charcoal-soft hover:underline">
                    {l.active ? "retire" : "reopen"}
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        )}
        <Form method="post" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="intent" value="add-location" />
          <input name="location_name" required placeholder="Location name (Main Shelter, Cat Annex…)" className={`${inputCls} mt-0 flex-1 min-w-48`} />
          <input name="location_address" placeholder="Address (optional)" className={`${inputCls} mt-0 flex-1 min-w-40`} />
          <button className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-semibold">Add location</button>
        </Form>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6 space-y-2">
        <h2 className="font-display font-semibold text-lg">Email</h2>
        <p className="text-sm text-charcoal-soft">
          Tutela sends application confirmations, approval/denial notes,
          donation receipts, and welcome emails through Cloudflare Email
          Sending. Set your <strong>public email</strong> above to get notified
          of new applications (it's also used as the reply-to on emails to
          adopters). Delivery activates once the sender domain is verified in
          the Cloudflare dashboard (Email → Sending) — until then, sends are
          logged and skipped, and nothing else is affected.
        </p>
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Plan</h2>
        <p className="mt-1 text-sm">
          You're on the <strong>{org.plan}</strong> plan. Online payments (adoption fees,
          donations) arrive once the Stripe connection is authorized.
        </p>
      </section>
    </div>
  );
}
