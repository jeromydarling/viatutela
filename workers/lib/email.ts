/**
 * App email via Cloudflare Email Service (send_email binding).
 *
 * Sends are best-effort and NEVER throw: a failed or unconfigured email
 * must never break an adoption application, a claim, or a donation.
 * Locally `wrangler dev` simulates delivery and logs the message.
 *
 * Real delivery requires a sender domain onboarded in the Cloudflare
 * dashboard (Email -> Sending) matching the EMAIL_FROM var.
 */

interface EmailSendResult {
  messageId?: string;
}

interface EmailBinding {
  send(message: {
    to: string | { email: string; name?: string };
    from: string;
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    headers?: Record<string, string>;
  }): Promise<EmailSendResult>;
}

export interface AppEmail {
  to: string;
  subject: string;
  /** main heading inside the branded template */
  heading: string;
  /** paragraphs of body text (plain strings; rendered as both text + html) */
  paragraphs: string[];
  /** optional call-to-action */
  cta?: { label: string; url: string };
  /** reply-to, e.g. the org's public email */
  replyTo?: string;
  /** extra headers, e.g. List-Unsubscribe for supporter mail */
  headers?: Record<string, string>;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(mail: AppEmail): string {
  const body = mail.paragraphs
    .map((p) => `<p style="margin:0 0 14px 0; line-height:1.6;">${esc(p)}</p>`)
    .join("");
  const cta = mail.cta
    ? `<p style="margin:22px 0;"><a href="${mail.cta.url}" style="background:#f6c445;color:#2e2a26;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:999px;display:inline-block;">${esc(mail.cta.label)}</a></p>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#fff9f0;font-family:'Nunito',Verdana,sans-serif;color:#2e2a26;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border-radius:28px;padding:32px;box-shadow:0 6px 24px rgba(46,42,38,0.12);">
      <div style="font-weight:800;font-size:18px;color:#2e7d54;margin-bottom:18px;">Tutela</div>
      <h1 style="font-size:24px;margin:0 0 16px 0;">${esc(mail.heading)}</h1>
      ${body}
      ${cta}
    </div>
    <p style="text-align:center;color:#5c554d;font-size:13px;margin-top:20px;">
      Peace and all good things to you and your animals.
    </p>
  </div>
</body></html>`;
}

function renderText(mail: AppEmail): string {
  const lines = [mail.heading, "", ...mail.paragraphs];
  if (mail.cta) lines.push("", `${mail.cta.label}: ${mail.cta.url}`);
  lines.push("", "— Tutela", "Peace and all good things to you and your animals.");
  return lines.join("\n");
}

/** Diagnostic send — same pipeline, but the error comes back instead of
 * vanishing into logs. Powers the Settings "send me a test email" button. */
export async function sendAppEmailDetailed(env: Env, mail: AppEmail): Promise<{ ok: boolean; error?: string }> {
  const binding = (env as unknown as { EMAIL?: EmailBinding }).EMAIL;
  const from = (env as unknown as { EMAIL_FROM?: string }).EMAIL_FROM;
  if (!binding) return { ok: false, error: "No send_email binding on this deployment." };
  if (!from) return { ok: false, error: "EMAIL_FROM isn't configured." };
  try {
    await binding.send({
      to: mail.to,
      from,
      subject: mail.subject,
      html: renderHtml(mail),
      text: renderText(mail),
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fire-and-forget send. Returns true if handed to the mail service. */
export async function sendAppEmail(env: Env, mail: AppEmail): Promise<boolean> {
  const binding = (env as unknown as { EMAIL?: EmailBinding }).EMAIL;
  const from = (env as unknown as { EMAIL_FROM?: string }).EMAIL_FROM;
  if (!binding || !from) {
    console.log(`[email skipped — no binding/sender] to=${mail.to} subject="${mail.subject}"`);
    return false;
  }
  try {
    const result = await binding.send({
      to: mail.to,
      from,
      subject: mail.subject,
      html: renderHtml(mail),
      text: renderText(mail),
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      ...(mail.headers ? { headers: mail.headers } : {}),
    });
    console.log(`[email sent] to=${mail.to} id=${result?.messageId ?? "?"}`);
    return true;
  } catch (err) {
    // E_SENDER_NOT_VERIFIED until the domain is onboarded — never break the flow.
    console.log(
      `[email failed] to=${mail.to} subject="${mail.subject}": ${err instanceof Error ? err.message : err}`,
    );
    return false;
  }
}
