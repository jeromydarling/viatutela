import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/network";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Transfer network — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  // deliberately cross-tenant: the whole point is every rescue sees the board
  const posts = await env.DB.prepare(
    `SELECT t.*, o.name org_name, o.address, o.demo FROM transfer_posts t JOIN orgs o ON o.id = t.org_id
     WHERE t.status = 'open' AND t.expires_at > datetime('now')
     ORDER BY CASE t.urgency WHEN 'urgent' THEN 0 WHEN 'soon' THEN 1 ELSE 2 END, t.created_at DESC LIMIT 100`,
  ).all<Record<string, unknown>>();
  const org = await env.DB.prepare(`SELECT email FROM orgs WHERE id = ?`).bind(user.org_id).first<{ email: string | null }>();
  return { posts: posts.results, myOrgId: user.org_id, orgEmail: org?.email ?? "" };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const str = (k: string) => String(f.get(k) ?? "").trim();

  if (intent === "post") {
    const kind = str("kind") === "have_space" ? "have_space" : "need_space";
    const email = str("contact_email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Give partner rescues an email to reach you at." };
    await env.DB.prepare(
      `INSERT INTO transfer_posts (id, org_id, kind, species, count, urgency, note, contact_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId("tp"), user.org_id, kind, str("species").slice(0, 40) || null,
        Math.max(1, Math.min(99, Number(f.get("count")) || 1)),
        ["routine", "soon", "urgent"].includes(str("urgency")) ? str("urgency") : "routine",
        str("note").slice(0, 500) || null, email.slice(0, 200),
      )
      .run();
    return { ok: "Posted to the network — every rescue on Via Tutela can see it for 14 days." };
  }

  if (intent === "resolve") {
    await env.DB.prepare(`UPDATE transfer_posts SET status = 'resolved' WHERE id = ? AND org_id = ?`)
      .bind(str("post_id"), user.org_id)
      .run();
    return { ok: "Marked resolved — glad it worked out. 💛" };
  }
  return null;
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";
const URGENCY_TONE: Record<string, string> = {
  urgent: "bg-terracotta/20 text-terracotta-deep",
  soon: "bg-sunflower-soft",
  routine: "bg-sky/15 text-sky-deep",
};

export default function TransferNetwork({ loaderData, actionData }: Route.ComponentProps) {
  const { posts, myOrgId, orgEmail } = loaderData;
  const nav = useNavigation();
  const a = actionData as { ok?: string; error?: string } | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Transfer network</h1>
        <p className="text-sm text-charcoal-soft">
          The board every rescue on Via Tutela shares. Full and need space? Have room to help? Say so here instead of the group text.
        </p>
      </div>

      {(a?.ok || a?.error) && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${a.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {a.error ?? a.ok}
        </p>
      )}

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Post to the board</h2>
        <Form method="post" className="mt-3 flex flex-wrap gap-2 items-end">
          <input type="hidden" name="intent" value="post" />
          <select name="kind" className={inputCls}>
            <option value="need_space">We need space (please take)</option>
            <option value="have_space">We have space (can take)</option>
          </select>
          <input name="species" placeholder="Species (dogs, cats…)" className={`${inputCls} w-36`} />
          <input name="count" type="number" min={1} max={99} defaultValue={1} className={`${inputCls} w-20`} aria-label="How many" />
          <select name="urgency" className={inputCls}>
            <option value="routine">Routine</option>
            <option value="soon">Within a week</option>
            <option value="urgent">Urgent</option>
          </select>
          <input name="contact_email" type="email" required defaultValue={orgEmail} placeholder="Contact email" className={`${inputCls} flex-1 min-w-44`} />
          <input name="note" placeholder="Details — ages, temperament, why" className={`${inputCls} w-full`} />
          <button disabled={nav.state !== "idle"} className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">
            Post it
          </button>
        </Form>
        <p className="mt-2 text-xs text-charcoal-soft">Posts show your rescue's name and this email to every Via Tutela shelter, and expire after 14 days.</p>
      </section>

      <section className="space-y-3">
        {posts.length === 0 && (
          <p className="rounded-blob bg-white shadow-soft p-8 text-center text-charcoal-soft">
            The board is quiet — no open posts right now. May it stay that way for the right reasons.
          </p>
        )}
        {posts.map((p) => (
          <div key={String(p.id)} className="rounded-blob bg-white shadow-soft p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.kind === "need_space" ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/20 text-meadow-deep"}`}>
                {p.kind === "need_space" ? "NEEDS SPACE" : "HAS SPACE"}
              </span>
              <span className="font-display font-semibold">{String(p.org_name)}</span>
              {Boolean(p.demo) && <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-xs font-semibold">demo</span>}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCY_TONE[String(p.urgency)]}`}>{String(p.urgency)}</span>
              <span className="text-sm text-charcoal-soft">
                {Number(p.count)} {String(p.species ?? "animal")}{Number(p.count) === 1 ? "" : "s"}
              </span>
              <span className="ml-auto text-xs text-charcoal-soft">{String(p.created_at).slice(0, 10)}</span>
            </div>
            {Boolean(p.note) && <p className="mt-2 text-sm">{String(p.note)}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a href={`mailto:${String(p.contact_email)}`} className="rounded-full bg-sunflower px-4 py-1.5 text-sm font-semibold shadow-soft">
                ✉️ Reach out
              </a>
              {String(p.org_id) === myOrgId && (
                <Form method="post">
                  <input type="hidden" name="intent" value="resolve" />
                  <input type="hidden" name="post_id" value={String(p.id)} />
                  <button className="text-sm font-semibold text-meadow-deep hover:underline">Mark resolved</button>
                </Form>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
