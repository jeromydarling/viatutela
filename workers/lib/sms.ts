/**
 * SMS via Twilio's REST API — no SDK needed on Workers, just fetch with
 * Basic auth. Same contract as email: best-effort, NEVER throws, and
 * degrades to a log line until the Twilio secrets are set.
 *
 * Activation levers (Worker secrets):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (E.164, e.g. +15551234567)
 *
 * Keep every message transactional (application status, reminders) —
 * marketing belongs in email where unsubscribe lives.
 */

interface TwilioEnv {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
}

/** Pure: normalize a user-typed phone number to E.164 (US default). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return null;
}

export function smsConfigured(env: Env): boolean {
  const e = env as unknown as TwilioEnv;
  return Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM);
}

/** Fire-and-forget send. Returns true if Twilio accepted the message. */
export async function sendSms(env: Env, to: string | null | undefined, body: string): Promise<boolean> {
  const e = env as unknown as TwilioEnv;
  const dest = normalizePhone(to);
  if (!dest) return false;
  if (!smsConfigured(env)) {
    console.log(`[sms skipped — Twilio secrets unset] to=${dest} body="${body.slice(0, 60)}…"`);
    return false;
  }
  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: dest, From: e.TWILIO_FROM!, Body: body.slice(0, 1500) }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resp.ok) {
      console.log(`[sms failed] to=${dest} status=${resp.status} ${(await resp.text()).slice(0, 200)}`);
      return false;
    }
    console.log(`[sms sent] to=${dest}`);
    return true;
  } catch (err) {
    console.log(`[sms failed] to=${dest}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}
