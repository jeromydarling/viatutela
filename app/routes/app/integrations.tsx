import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/integrations";
import { requireUser } from "../../lib/auth.server";
import { newId, newToken } from "../../../workers/lib/ids";
import {
  WEBHOOK_EVENTS,
  cleanEventList,
  generateApiKey,
  hashApiKey,
  sendTestPing,
  validateWebhookUrl,
} from "../../../workers/lib/integrations";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Integrations — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);

  let org = await env.DB.prepare(`SELECT slug, ics_token FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ slug: string; ics_token: string | null }>();
  if (org && !org.ics_token) {
    const token = newToken();
    await env.DB.prepare(`UPDATE orgs SET ics_token = ? WHERE id = ?`).bind(token, user.org_id).run();
    org = { ...org, ics_token: token };
  }

  const [keys, hooks, deliveries] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, prefix, scope, created_at, last_used_at FROM api_keys
       WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 20`,
    ).bind(user.org_id).all<Record<string, string | null>>(),
    env.DB.prepare(
      `SELECT id, url, events, active, failure_count, last_status, last_delivery_at FROM webhooks
       WHERE org_id = ? ORDER BY created_at DESC LIMIT 20`,
    ).bind(user.org_id).all<Record<string, string | number | null>>(),
    env.DB.prepare(
      `SELECT d.event, d.status, d.attempts, d.last_error, d.created_at, w.url
       FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id
       WHERE d.org_id = ? ORDER BY d.created_at DESC LIMIT 12`,
    ).bind(user.org_id).all<Record<string, string | number | null>>(),
  ]);

  const origin = new URL(request.url).origin;
  return {
    keys: keys.results,
    hooks: hooks.results,
    deliveries: deliveries.results,
    apiBase: `${origin}/api/v1`,
    icsUrl: `${origin}/api/feeds/shifts/${org?.ics_token}.ics`,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));

  if (intent === "create-key") {
    const name = String(f.get("name") ?? "").trim().slice(0, 60) || "API key";
    const count = await env.DB.prepare(
      `SELECT COUNT(*) n FROM api_keys WHERE org_id = ? AND revoked_at IS NULL`,
    ).bind(user.org_id).first<{ n: number }>();
    if ((count?.n ?? 0) >= 10) return { error: "Ten active keys is plenty — revoke one you're not using first." };
    const scope = String(f.get("scope")) === "write" ? "write" : "read";
    const token = generateApiKey();
    await env.DB.prepare(
      `INSERT INTO api_keys (id, org_id, name, prefix, key_hash, scope) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId("ak"), user.org_id, name, token.slice(0, 12) + "…", await hashApiKey(token), scope)
      .run();
    return { newKey: token, ok: "Key created — copy it now, it won't be shown again." };
  }

  if (intent === "revoke-key") {
    await env.DB.prepare(`UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND org_id = ?`)
      .bind(String(f.get("key_id")), user.org_id)
      .run();
    return { ok: "Key revoked. Anything still using it will get a 401." };
  }

  if (intent === "add-webhook") {
    const checked = validateWebhookUrl(String(f.get("url") ?? ""));
    if (!checked.ok) return { error: checked.error };
    const events = cleanEventList(f.getAll("events").map(String));
    if (!events) return { error: "Pick at least one event to send." };
    const count = await env.DB.prepare(`SELECT COUNT(*) n FROM webhooks WHERE org_id = ?`)
      .bind(user.org_id).first<{ n: number }>();
    if ((count?.n ?? 0) >= 10) return { error: "Ten webhooks is the limit — remove one first." };
    const secret = newToken();
    await env.DB.prepare(
      `INSERT INTO webhooks (id, org_id, url, secret, events) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(newId("wh"), user.org_id, checked.url, secret, events)
      .run();
    return {
      newSecret: secret,
      ok: "Webhook added — save the signing secret now, it won't be shown again.",
    };
  }

  if (intent === "delete-webhook") {
    const id = String(f.get("webhook_id"));
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM webhook_deliveries WHERE webhook_id = ? AND org_id = ?`).bind(id, user.org_id),
      env.DB.prepare(`DELETE FROM webhooks WHERE id = ? AND org_id = ?`).bind(id, user.org_id),
    ]);
    return { ok: "Webhook removed." };
  }

  if (intent === "toggle-webhook") {
    await env.DB.prepare(
      `UPDATE webhooks SET active = 1 - active, failure_count = 0 WHERE id = ? AND org_id = ?`,
    )
      .bind(String(f.get("webhook_id")), user.org_id)
      .run();
    return { ok: "Updated." };
  }

  if (intent === "test-webhook") {
    const landed = await sendTestPing(env, user.org_id, String(f.get("webhook_id")));
    return landed
      ? { ok: "Ping delivered — your endpoint answered with a 2xx. 🎉" }
      : { error: "The ping didn't land — check the delivery log below for the response." };
  }

  if (intent === "regen-ics") {
    await env.DB.prepare(`UPDATE orgs SET ics_token = ? WHERE id = ?`).bind(newToken(), user.org_id).run();
    return { ok: "Calendar link regenerated — the old link stopped working." };
  }

  return null;
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";
const secretCls = "block w-full mt-1 rounded-xl bg-charcoal text-cream font-mono text-xs px-3 py-2 break-all select-all";

export default function Integrations({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const a = actionData as { ok?: string; error?: string; newKey?: string; newSecret?: string } | undefined;
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/settings" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Settings</Link>
        <h1 className="text-2xl font-display font-semibold">Integrations</h1>
        <p className="text-sm text-charcoal-soft max-w-2xl">
          Connect Tutela to Zapier, Make, n8n, or your own tools. Data you send out through these
          integrations is under your control — cover it in your own privacy policy. Not sure where to
          start?{" "}
          <Link to="/app/settings/integrations/recipes" className="font-semibold text-meadow-deep hover:underline">
            Browse the automation recipes →
          </Link>
        </p>
      </div>

      {a?.error && <p className="rounded-2xl bg-terracotta/15 text-terracotta-deep px-4 py-2.5 font-semibold">{a.error}</p>}
      {a?.ok && (
        <div className="rounded-2xl bg-meadow/15 text-meadow-deep px-4 py-2.5 font-semibold">
          {a.ok}
          {a.newKey && <code className={secretCls}>{a.newKey}</code>}
          {a.newSecret && <code className={secretCls}>{a.newSecret}</code>}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">API keys</h2>
          <p className="text-sm text-charcoal-soft mt-1">
            Read-only access to your data at <code className="text-xs">{d.apiBase}/animals</code>,{" "}
            <code className="text-xs">/contacts</code>, <code className="text-xs">/applications</code>,{" "}
            <code className="text-xs">/donations</code>, <code className="text-xs">/adoptions</code>. Send the key as{" "}
            <code className="text-xs">Authorization: Bearer …</code>; page with <code className="text-xs">?cursor=</code>,
            filter with <code className="text-xs">?since=</code>. 120 requests/minute.
          </p>
          <Form method="post" className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="create-key" />
            <input name="name" placeholder="What's this key for? e.g. Zapier" className={`${inputCls} flex-1 min-w-40`} maxLength={60} />
            <select name="scope" className={inputCls} title="Write access lets tools create contacts, donations, and animals">
              <option value="read">Read-only</option>
              <option value="write">Read + write</option>
            </select>
            <button disabled={busy} className="rounded-full bg-meadow text-white px-4 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
              Create key
            </button>
          </Form>
          <ul className="mt-3 divide-y divide-cream">
            {d.keys.map((k) => (
              <li key={String(k.id)} className="py-2.5 flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{k.name}</div>
                  <div className="text-xs text-charcoal-soft">
                    <code>{k.prefix}</code> · {k.scope === "write" ? "read + write" : "read-only"} ·{" "}
                    {k.last_used_at ? `last used ${String(k.last_used_at).slice(0, 10)}` : "never used"}
                  </div>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="revoke-key" />
                  <input type="hidden" name="key_id" value={String(k.id)} />
                  <button disabled={busy} className="text-xs font-semibold text-terracotta-deep hover:underline">Revoke</button>
                </Form>
              </li>
            ))}
            {d.keys.length === 0 && <li className="py-2.5 text-sm text-charcoal-soft">No keys yet.</li>}
          </ul>
        </section>

        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">Volunteer shift calendar</h2>
          <p className="text-sm text-charcoal-soft mt-1">
            Subscribe in Google or Apple Calendar and shifts appear automatically. Share the link with
            your volunteer crew — anyone with it can see shift titles and times (nothing else).
          </p>
          <code className={secretCls}>{d.icsUrl}</code>
          <Form method="post" className="mt-2">
            <input type="hidden" name="intent" value="regen-ics" />
            <button disabled={busy} className="text-xs font-semibold text-charcoal-soft hover:text-charcoal underline">
              Regenerate link (revokes the old one)
            </button>
          </Form>
        </section>
      </div>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Webhooks</h2>
        <p className="text-sm text-charcoal-soft mt-1 max-w-2xl">
          We POST a JSON payload to your URL when things happen — the glue for Zapier's
          "Webhooks" trigger and friends. Every delivery is signed:{" "}
          <code className="text-xs">X-Tutela-Signature: sha256=HMAC(secret, timestamp + "." + body)</code>.
        </p>
        <Form method="post" className="mt-3 space-y-2">
          <input type="hidden" name="intent" value="add-webhook" />
          <input name="url" placeholder="https://hooks.zapier.com/…" className={`${inputCls} w-full`} maxLength={500} />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e.key} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="events" value={e.key} defaultChecked />
                {e.label}
              </label>
            ))}
          </div>
          <button disabled={busy} className="rounded-full bg-meadow text-white px-4 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
            Add webhook
          </button>
        </Form>

        <ul className="mt-4 divide-y divide-cream">
          {d.hooks.map((h) => (
            <li key={String(h.id)} className="py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{h.url}</div>
                <div className="text-xs text-charcoal-soft">
                  {String(h.events).split(",").length} events · {h.active ? (h.last_status ? `last: ${h.last_status}` : "no deliveries yet") : "paused"}
                  {Number(h.failure_count) > 0 && ` · ${h.failure_count} consecutive failures`}
                </div>
              </div>
              <Form method="post">
                <input type="hidden" name="intent" value="test-webhook" />
                <input type="hidden" name="webhook_id" value={String(h.id)} />
                <button disabled={busy} className="text-xs font-semibold text-meadow-deep hover:underline">Send test ping</button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="toggle-webhook" />
                <input type="hidden" name="webhook_id" value={String(h.id)} />
                <button disabled={busy} className="text-xs font-semibold text-charcoal-soft hover:underline">
                  {h.active ? "Pause" : "Resume"}
                </button>
              </Form>
              <Form method="post" onSubmit={(e) => { if (!confirm("Remove this webhook?")) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="delete-webhook" />
                <input type="hidden" name="webhook_id" value={String(h.id)} />
                <button disabled={busy} className="text-xs font-semibold text-terracotta-deep hover:underline">Remove</button>
              </Form>
            </li>
          ))}
          {d.hooks.length === 0 && <li className="py-2.5 text-sm text-charcoal-soft">No webhooks yet.</li>}
        </ul>

        {d.deliveries.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-display font-semibold">Recent deliveries</h3>
            <ul className="mt-1 divide-y divide-cream text-xs">
              {d.deliveries.map((del, i) => (
                <li key={i} className="py-1.5 flex flex-wrap gap-2 items-center">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${del.status === "ok" ? "bg-meadow/20 text-meadow-deep" : del.status === "pending" ? "bg-sunflower-soft" : "bg-terracotta/20 text-terracotta-deep"}`}>
                    {String(del.status)}
                  </span>
                  <code>{String(del.event)}</code>
                  <span className="text-charcoal-soft truncate max-w-64">{String(del.url)}</span>
                  <span className="text-charcoal-soft">{String(del.created_at)}</span>
                  {del.last_error != null && <span className="text-terracotta-deep">{String(del.last_error)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
