import { Form } from "react-router";
import type { Route } from "./+types/settings";
import { requireUser } from "../../lib/auth.server";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Settings — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = await env.DB.prepare(
    `SELECT id, name, slug, plan, about, website, email, phone, address FROM orgs WHERE id = ?`,
  )
    .bind(user.org_id)
    .first<Record<string, string | null>>();
  const origin = new URL(request.url).origin;
  return { org: org!, origin };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const str = (k: string) => String(f.get(k) ?? "").trim() || null;
  const name = str("name");
  if (!name) return { error: "Your organization needs a name." };
  await env.DB.prepare(
    `UPDATE orgs SET name=?, about=?, website=?, email=?, phone=?, address=? WHERE id=?`,
  )
    .bind(name, str("about"), str("website"), str("email"), str("phone"), str("address"), user.org_id)
    .run();
  return { ok: "Saved." };
}

const inputCls =
  "mt-1 w-full rounded-xl border-2 border-cream bg-cream px-4 py-2.5 focus:border-meadow outline-none";

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { org, origin } = loaderData;

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
        </div>
        <button className="rounded-full bg-meadow text-white px-6 py-2.5 font-display font-semibold shadow-soft">
          Save
        </button>
      </Form>

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
        <h2 className="font-display font-semibold text-lg">Plan</h2>
        <p className="mt-1 text-sm">
          You're on the <strong>{org.plan}</strong> plan. Online payments (adoption fees,
          donations) arrive once the Stripe connection is authorized.
        </p>
      </section>
    </div>
  );
}
