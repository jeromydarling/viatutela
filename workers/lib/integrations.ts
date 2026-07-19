/**
 * Integrations plumbing: API keys, outbound webhooks, calendar feeds.
 *
 * Design rules:
 * - API keys are shown once and stored only as a SHA-256 hash.
 * - Webhook payloads carry the minimum useful fields — no notes, no
 *   medical records, nothing the receiving service doesn't need.
 * - Webhook URLs pass an SSRF guard (https, public hostnames only).
 * - Deliveries are HMAC-signed and never block the user-facing action.
 */

import { newId, newToken } from "./ids";

// ---------- API keys ----------

export const API_KEY_PREFIX = "vt_live_";

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${newToken()}`;
}

export function isApiKeyFormat(token: string): boolean {
  return /^vt_live_[a-f0-9]{48}$/.test(token);
}

export async function hashApiKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ApiKeyAuth {
  keyId: string;
  orgId: string;
  scope: string;
  lastUsedAt: string | null;
}

export async function verifyApiKey(env: Env, token: string): Promise<ApiKeyAuth | null> {
  if (!isApiKeyFormat(token)) return null;
  const hash = await hashApiKey(token);
  const row = await env.DB.prepare(
    `SELECT id, org_id, scope, last_used_at FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`,
  )
    .bind(hash)
    .first<{ id: string; org_id: string; scope: string; last_used_at: string | null }>();
  if (!row) return null;
  return { keyId: row.id, orgId: row.org_id, scope: row.scope, lastUsedAt: row.last_used_at };
}

// ---------- cursor pagination ----------

export function encodeCursor(createdAt: string, id: string): string {
  return btoa(`${createdAt}|${id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const raw = atob(cursor.replace(/-/g, "+").replace(/_/g, "/"));
    const sep = raw.lastIndexOf("|");
    if (sep < 1) return null;
    const createdAt = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (!createdAt || !id || !/^[\x20-\x7e]+$/.test(raw)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// ---------- webhook events ----------

export const WEBHOOK_EVENTS = [
  { key: "application.created", label: "New adoption application" },
  { key: "adoption.created", label: "Adoption completed" },
  { key: "donation.created", label: "Donation recorded" },
  { key: "animal.created", label: "New animal added" },
  { key: "volunteer.signup", label: "Volunteer shift signup" },
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["key"] | "ping";

export function isKnownEvent(event: string): boolean {
  return WEBHOOK_EVENTS.some((e) => e.key === event);
}

/** Parse a submitted list of events into a clean comma list. */
export function cleanEventList(events: string[]): string {
  return WEBHOOK_EVENTS.filter((e) => events.includes(e.key))
    .map((e) => e.key)
    .join(",");
}

export function webhookSubscribes(eventsCsv: string, event: string): boolean {
  if (event === "ping") return true;
  return eventsCsv.split(",").includes(event);
}

// ---------- SSRF guard ----------

/**
 * Webhook URLs must be https to a public hostname. Rejects IP literals,
 * localhost-ish names, and single-label/internal hostnames so a webhook
 * can never be pointed at infrastructure.
 */
export function validateWebhookUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed.length > 500) return { ok: false, error: "That URL is too long." };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Webhook URLs must use https://." };
  if (url.username || url.password) return { ok: false, error: "URLs with embedded credentials aren't allowed." };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // IPv4 (incl. hex/octal-looking labels), IPv6, or anything all-numeric
  if (host.includes(":") || /^[0-9x.]+$/.test(host)) {
    return { ok: false, error: "IP addresses aren't allowed — use a hostname." };
  }
  if (!host.includes(".")) return { ok: false, error: "That hostname doesn't look public." };
  const blockedSuffixes = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet"];
  if (host === "localhost" || blockedSuffixes.some((s) => host.endsWith(s))) {
    return { ok: false, error: "That hostname doesn't look public." };
  }
  return { ok: true, url: url.toString() };
}

// ---------- signing ----------

export async function signWebhook(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- emit + deliver ----------

const MAX_ATTEMPTS = 5;
const AUTO_PAUSE_AFTER = 25; // consecutive failures across deliveries

interface WebhookRow {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  events: string;
  failure_count: number;
}

/**
 * Fire an event to every subscribed webhook for the org. Never throws;
 * delivery happens in waitUntil so the user-facing action is never
 * slowed or failed by a slow endpoint.
 */
export async function emitEvent(
  env: Env,
  ctx: ExecutionContext,
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const hooks = await env.DB.prepare(
      `SELECT id, org_id, url, secret, events, failure_count FROM webhooks WHERE org_id = ? AND active = 1`,
    )
      .bind(orgId)
      .all<WebhookRow>();
    const targets = hooks.results.filter((h) => webhookSubscribes(h.events, event));
    if (!targets.length) return;

    for (const hook of targets) {
      const deliveryId = newId("whd");
      const payload = JSON.stringify({
        event,
        delivery_id: deliveryId,
        timestamp: new Date().toISOString(),
        data,
      });
      await env.DB.prepare(
        `INSERT INTO webhook_deliveries (id, org_id, webhook_id, event, payload_json) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(deliveryId, orgId, hook.id, event, payload)
        .run();
      ctx.waitUntil(attemptDelivery(env, deliveryId, hook, payload));
    }
  } catch (err) {
    console.log(`[webhook emit failed] ${event}: ${err instanceof Error ? err.message : err}`);
  }
}

async function attemptDelivery(
  env: Env,
  deliveryId: string,
  hook: Pick<WebhookRow, "id" | "url" | "secret" | "failure_count">,
  payload: string,
): Promise<boolean> {
  const timestamp = String(Date.now());
  let ok = false;
  let statusNote = "";
  try {
    const signature = await signWebhook(hook.secret, timestamp, payload);
    const resp = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Tutela-Webhooks/1.0",
        "X-Tutela-Delivery": deliveryId,
        "X-Tutela-Timestamp": timestamp,
        "X-Tutela-Signature": `sha256=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
      // never follow redirects — a 3xx is recorded as a failure, and a
      // redirect can't bounce the delivery to somewhere we didn't validate
      redirect: "manual",
    });
    ok = resp.status >= 200 && resp.status < 300;
    statusNote = `HTTP ${resp.status}`;
  } catch (err) {
    statusNote = (err instanceof Error ? err.message : String(err)).slice(0, 200);
  }

  if (ok) {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE webhook_deliveries SET status = 'ok', attempts = attempts + 1, delivered_at = datetime('now'), last_error = NULL WHERE id = ?`,
      ).bind(deliveryId),
      env.DB.prepare(
        `UPDATE webhooks SET failure_count = 0, last_status = ?, last_delivery_at = datetime('now') WHERE id = ?`,
      ).bind(statusNote, hook.id),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE webhook_deliveries SET
           attempts = attempts + 1,
           last_error = ?,
           status = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN 'dead' ELSE 'failed' END,
           next_attempt_at = datetime('now', '+' || ((attempts + 1) * (attempts + 1)) || ' hours')
         WHERE id = ?`,
      ).bind(statusNote, deliveryId),
      env.DB.prepare(
        `UPDATE webhooks SET
           failure_count = failure_count + 1,
           last_status = ?,
           last_delivery_at = datetime('now'),
           active = CASE WHEN failure_count + 1 >= ${AUTO_PAUSE_AFTER} THEN 0 ELSE active END
         WHERE id = ?`,
      ).bind(statusNote, hook.id),
    ]);
  }
  return ok;
}

/** Send a ping to one specific webhook right now; returns whether it landed. */
export async function sendTestPing(env: Env, orgId: string, webhookId: string): Promise<boolean> {
  const hook = await env.DB.prepare(
    `SELECT id, url, secret, failure_count FROM webhooks WHERE id = ? AND org_id = ?`,
  )
    .bind(webhookId, orgId)
    .first<Pick<WebhookRow, "id" | "url" | "secret" | "failure_count">>();
  if (!hook) return false;
  const deliveryId = newId("whd");
  const payload = JSON.stringify({
    event: "ping",
    delivery_id: deliveryId,
    timestamp: new Date().toISOString(),
    data: { message: "Hello from Tutela — your webhook is wired up." },
  });
  await env.DB.prepare(
    `INSERT INTO webhook_deliveries (id, org_id, webhook_id, event, payload_json) VALUES (?, ?, ?, 'ping', ?)`,
  )
    .bind(deliveryId, orgId, hook.id, payload)
    .run();
  return attemptDelivery(env, deliveryId, hook, payload);
}

/** Cron sweep: retry failed deliveries whose backoff has elapsed. */
export async function retryPendingDeliveries(env: Env): Promise<void> {
  const due = await env.DB.prepare(
    `SELECT d.id, d.payload_json, w.id hook_id, w.url, w.secret, w.failure_count
     FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id
     WHERE d.status = 'failed' AND d.attempts < ${MAX_ATTEMPTS}
       AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= datetime('now'))
       AND w.active = 1
     LIMIT 20`,
  ).all<{ id: string; payload_json: string; hook_id: string; url: string; secret: string; failure_count: number }>();
  for (const row of due.results) {
    await attemptDelivery(
      env,
      row.id,
      { id: row.hook_id, url: row.url, secret: row.secret, failure_count: row.failure_count },
      row.payload_json,
    );
  }
}

/** Housekeeping: delivery log is an audit trail, not an archive. */
export async function pruneOldDeliveries(env: Env): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM webhook_deliveries WHERE created_at < datetime('now', '-30 days')`,
  ).run();
}

// ---------- ICS calendar feed ----------

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export interface IcsShift {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  end_time: string | null;
  notes: string | null;
}

function icsDateTime(date: string, time: string | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const compactDate = date.replace(/-/g, "");
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    return `${compactDate}T${time.replace(":", "")}00`;
  }
  return compactDate;
}

/**
 * A minimal, valid VCALENDAR of volunteer shifts. Times are emitted as
 * floating local time — shelters and their volunteers share a timezone.
 */
export function buildShiftsIcs(orgName: string, shifts: IcsShift[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tutela//Volunteer Shifts//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${orgName} — volunteer shifts`)}`,
  ];
  for (const s of shifts) {
    const start = icsDateTime(s.date, s.start_time);
    if (!start) continue;
    const end = s.end_time ? icsDateTime(s.date, s.end_time) : null;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${s.id}@tutela`);
    lines.push(`DTSTAMP:${start.length === 8 ? `${start}T000000` : start}`);
    if (start.length === 8) {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
    } else {
      lines.push(`DTSTART:${start}`);
      if (end && end.length !== 8) lines.push(`DTEND:${end}`);
    }
    lines.push(`SUMMARY:${icsEscape(s.title)}`);
    if (s.notes) lines.push(`DESCRIPTION:${icsEscape(s.notes.slice(0, 500))}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
