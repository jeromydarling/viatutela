import type { Route } from "./+types/privacy";
import { SiteHeader, SiteFooter } from "../components/site";
import { marketingMeta } from "../lib/seo";

export function meta(_: Route.MetaArgs) {
  return marketingMeta({
    title: "Privacy — Tutela",
    description: "How Tutela handles your data, plainly: shelters own everything, we sell nothing.",
    path: "/privacy",
  });
}

const SECTIONS: { h: string; ps: string[] }[] = [
  {
    h: "The short version",
    ps: [
      "Shelters own their data — every animal, adopter, donor, and record belongs to the organization that entered it, exportable in full at any time, no strings. We don't sell data, we don't run ads, and we only collect what the product needs to work.",
    ],
  },
  {
    h: "What we collect",
    ps: [
      "Account data: your name, email, and a salted password hash. Organization data: everything your shelter enters — animals, medical records, contacts, applications, donations, photos and videos, website content. Adopter data submitted through public forms (applications, waitlist signups, volunteer signups) is collected on behalf of the shelter it was submitted to, and that shelter controls it.",
      "We keep minimal technical logs (errors and usage counters) to keep the service healthy. We do not use tracking pixels or third-party analytics on your dashboard, and shelters' public sites get no advertising trackers from us.",
    ],
  },
  {
    h: "Where it lives",
    ps: [
      "Everything runs on Cloudflare's global platform — database (D1), file storage (R2), and compute (Workers). Data in transit is encrypted with TLS; data at rest is encrypted by Cloudflare's infrastructure. Payments, when enabled, are processed by Stripe — card numbers never touch our servers.",
    ],
  },
  {
    h: "AI features",
    ps: [
      "Some features send content to AI providers to do their job: photos for profile drafts and photo review (Anthropic), text for bios, replies, and marketing drafts (Anthropic, with Cloudflare Workers AI as fallback). This happens only when someone at your shelter triggers the feature, the content sent is only what the feature needs, and AI output never publishes anywhere without a human approving it. Every AI action is logged in your organization's audit trail. Our AI providers do not train on this data.",
    ],
  },
  {
    h: "Email and unsubscribing",
    ps: [
      "We send transactional email (application updates, reminders you configure) and, for supporters who opted in, shelter newsletters. Every non-essential email carries a one-click unsubscribe that works immediately and is honored permanently through a suppression list.",
    ],
  },
  {
    h: "Cookies",
    ps: [
      "One cookie: your session, so you stay signed in. HttpOnly, Secure, first-party. That's the whole list.",
    ],
  },
  {
    h: "Deleting data",
    ps: [
      "Shelters can delete animals, contacts, and records at any time, and deletion removes the underlying files too. To delete an entire organization and account, email us and we'll complete it within 30 days. Adopters who want their application data removed can ask the shelter they applied to, or email us directly.",
    ],
  },
  {
    h: "Questions",
    ps: [
      "Write to privacy@viatutela.pet — a human reads it. If we ever make a meaningful change to this policy, we'll email every account before it takes effect.",
    ],
  },
];

export default function Privacy() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-4xl font-display font-semibold">Privacy, plainly.</h1>
        <p className="mt-3 text-lg text-charcoal-soft">
          Last updated July 2026. No legalese for its own sake — this is what we actually do.
        </p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-display font-semibold">{s.h}</h2>
              {s.ps.map((p) => (
                <p key={p.slice(0, 40)} className="mt-2 text-charcoal-soft leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
