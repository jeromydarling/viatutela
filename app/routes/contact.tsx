import { useEffect, useRef } from "react";
import { Form, Link } from "react-router";
import type { Route } from "./+types/contact";
import { getEnv } from "../lib/auth.server";
import { marketingMeta } from "../lib/seo";
import { sendAppEmail } from "../../workers/lib/email";
import { SiteHeader, SiteFooter } from "../components/site";
import { HeartPawDoodle } from "../components/doodles";

const CONTACT_EMAIL = "gardener@thecros.app";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "Contact Us — Tutela",
    description:
      "Questions about Tutela, shelter software, or migrating your rescue's data? Write to us — a real person reads every message.",
    path: "/contact",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  // supports a prefilled message, e.g. from the error page's "tell a real
  // person right now" link — capped short so it can't be abused as a text dump
  const note = new URL(request.url).searchParams.get("note")?.slice(0, 300) ?? "";
  return { note };
}

export async function action({ context, request }: Route.ActionArgs) {
  const env = getEnv(context);
  const f = await request.formData();
  if (String(f.get("website") ?? "")) return { ok: true }; // honeypot: bots fill it, humans never see it

  const name = String(f.get("name") ?? "").trim().slice(0, 120);
  const email = String(f.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const message = String(f.get("message") ?? "").trim().slice(0, 4000);
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: "We need your name, a real email, and a message — that's all." };
  }

  // form-timing trap: humans take a few seconds to fill three fields; a
  // stamp that's PRESENT but sub-2s is a bot. A missing stamp (no-JS, or
  // a cached prefetch) is NOT penalized — the content scorer covers those.
  const renderedAt = Number(f.get("rendered_at") ?? "0");
  const tooFast = renderedAt > 0 && Date.now() - renderedAt < 2000;

  // per-IP rate limit: a person sends one message, not ten
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  let overLimit = false;
  try {
    const key = `contact_rl:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
    const n = Number((await env.CONFIG.get(key)) ?? "0") + 1;
    overLimit = n > 3;
    await env.CONFIG.put(key, String(n), { expirationTtl: 3600 });
  } catch {
    // KV hiccup never blocks a real message
  }

  const { isSpam, scoreSpam } = await import("../../workers/lib/spam");
  const spam = scoreSpam({ name, email, message });

  // Silently accept spam/bot traffic (same "thanks!" as a human) so bots
  // never learn they were filtered — but send nothing.
  if (tooFast || overLimit || spam.score >= 3 || isSpam({ name, email, message })) {
    console.log(`[contact spam dropped] ip=${ip} score=${spam.score} reasons=[${spam.reasons.join("; ")}] fast=${tooFast} rl=${overLimit}`);
    return { ok: true };
  }

  await sendAppEmail(env, {
    to: CONTACT_EMAIL,
    subject: `Tutela contact form: ${name}`,
    heading: `Message from ${name}`,
    paragraphs: [
      `From: ${name} <${email}>`,
      message,
      `— sent via the Tutela contact form`,
    ],
    replyTo: email,
  });
  return { ok: true };
}

const inputCls = "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function Contact({ loaderData, actionData }: Route.ComponentProps) {
  const a = actionData as { ok?: boolean; error?: string } | undefined;
  const note = loaderData?.note ?? "";
  // stamp the real per-visitor load time on the client (the page HTML is
  // edge-cached, so a server value would be stale for everyone)
  const stampRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (stampRef.current) stampRef.current.value = String(Date.now());
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <div className="text-center">
          <HeartPawDoodle className="w-14 h-14 mx-auto text-terracotta" />
          <h1 className="mt-3 text-3xl sm:text-4xl font-display font-semibold">Say hello</h1>
          <p className="mt-3 text-lg text-charcoal-soft">
            Questions, ideas, a migration that's got you nervous, or just a picture of your dog —
            a real person reads every message.
          </p>
        </div>

        {a?.ok ? (
          <div className="mt-10 rounded-blob bg-white shadow-soft p-8 text-center">
            <p className="text-3xl">💌</p>
            <h2 className="mt-2 text-xl font-display font-semibold">Got it — thank you!</h2>
            <p className="mt-2 text-charcoal-soft">
              Your message is on its way. We'll get back to you at the email you gave us.
            </p>
            <Link to="/" className="mt-4 inline-block font-semibold text-meadow-deep hover:underline">
              ← Back home
            </Link>
          </div>
        ) : (
          <Form method="post" className="mt-10 rounded-blob bg-white shadow-soft p-6 sm:p-8 space-y-4">
            {a?.error && (
              <p className="rounded-2xl bg-terracotta/15 text-terracotta-deep px-4 py-2.5 font-semibold">{a.error}</p>
            )}
            <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
            <input ref={stampRef} type="hidden" name="rendered_at" defaultValue="" />
            <label className="block">
              <span className="font-semibold text-sm">Your name *</span>
              <input name="name" required maxLength={120} className={inputCls} />
            </label>
            <label className="block">
              <span className="font-semibold text-sm">Your email *</span>
              <input name="email" type="email" required maxLength={200} className={inputCls} />
            </label>
            <label className="block">
              <span className="font-semibold text-sm">Your message *</span>
              <textarea name="message" required rows={6} maxLength={4000} defaultValue={note} className={inputCls} />
            </label>
            <button className="w-full rounded-full bg-meadow text-white py-3 font-display font-semibold text-lg shadow-soft hover:shadow-lift transition-shadow">
              Send it our way
            </button>
          </Form>
        )}

        <p className="mt-10 text-center text-sm text-charcoal-soft">
          Tutela is part of the{" "}
          <a href="https://thecros.app" className="font-semibold text-meadow-deep hover:underline" rel="noreferrer">
            CROS family of apps
          </a>{" "}
          — small, carefully made software with a soft spot for good causes.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
