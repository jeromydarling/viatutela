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

export default function Contact({ actionData }: Route.ComponentProps) {
  const a = actionData as { ok?: boolean; error?: string } | undefined;

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
              <textarea name="message" required rows={6} maxLength={4000} className={inputCls} />
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
