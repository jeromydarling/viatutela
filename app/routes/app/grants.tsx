import { aiAvailable } from "../../../workers/lib/ai-flags";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/grants";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { getAnthropic, logAiWrite } from "../../../workers/lib/ai";
import { gatherGrantStats, writeGrantDraft } from "../../../workers/lib/ai-grants";
import { Markdown } from "../../components/markdown";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Grant writer — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const drafts = await env.DB.prepare(
    `SELECT id, funder, amount, focus, content, created_at FROM grant_drafts WHERE org_id = ? ORDER BY created_at DESC LIMIT 20`,
  )
    .bind(user.org_id)
    .all<Record<string, string>>();
  const stats = await gatherGrantStats(env, user.org_id);
  return { drafts: drafts.results, stats, aiReady: aiAvailable(env) };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const str = (k: string) => String(f.get(k) ?? "").trim();

  if (intent === "draft") {
    const funder = str("funder");
    if (!funder) return { error: "Who's the funder?" };
    const stats = await gatherGrantStats(env, user.org_id);
    const res = await writeGrantDraft(env, {
      orgId: user.org_id,
      stats,
      funder,
      amount: str("amount"),
      focus: str("focus"),
      notes: str("notes"),
    });
    if (res.error || !res.content) return { error: res.error ?? "The draft didn't come back." };
    await env.DB.prepare(
      `INSERT INTO grant_drafts (id, org_id, funder, amount, focus, content) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId("gr"), user.org_id, funder.slice(0, 200), str("amount").slice(0, 50) || null, str("focus").slice(0, 500) || null, res.content)
      .run();
    await logAiWrite(env, user.org_id, user.user_id, "grant_draft", `funder: ${funder.slice(0, 100)}`);
    return { ok: "Draft ready below — edit it into your own words before submitting." };
  }

  if (intent === "delete") {
    await env.DB.prepare(`DELETE FROM grant_drafts WHERE id = ? AND org_id = ?`).bind(str("draft_id"), user.org_id).run();
    return { ok: "Draft removed." };
  }
  return null;
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

export default function Grants({ loaderData, actionData }: Route.ComponentProps) {
  const { drafts, stats, aiReady } = loaderData;
  const nav = useNavigation();
  const a = actionData as { ok?: string; error?: string } | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">✨ Grant writer</h1>
        <p className="text-sm text-charcoal-soft">
          Funder-ready narratives drafted from your real numbers — Petco Love, Best Friends, community foundations.
        </p>
      </div>

      {(a?.ok || a?.error) && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${a.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {a.error ?? a.ok}
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">Your evidence</h2>
          <ul className="mt-2 text-sm space-y-1.5">
            <li><strong>{stats.adoptions_12mo}</strong> adoptions in 12 months</li>
            <li><strong>{stats.intakes_12mo}</strong> intakes · <strong>{stats.in_care}</strong> in care now</li>
            <li><strong>{stats.avg_days_to_adoption ?? "—"}</strong> avg days to home</li>
            <li><strong>{stats.active_fosters}</strong> active fosters · <strong>{stats.volunteers}</strong> volunteers</li>
            <li><strong>{Math.round(stats.volunteer_hours_12mo)}</strong> logged volunteer hours</li>
            <li><strong>${Math.round(stats.donations_12mo).toLocaleString()}</strong> from <strong>{stats.donors_12mo}</strong> donors</li>
          </ul>
          <p className="mt-3 text-xs text-charcoal-soft">
            These flow straight into every draft. Log volunteer shifts to make the hours line sing.
          </p>
        </section>

        <section className="rounded-blob bg-white shadow-soft p-6 lg:col-span-2">
          <h2 className="font-display font-semibold text-lg">New application draft</h2>
          {!aiReady ? (
            <p className="mt-2 text-sm text-charcoal-soft">Needs the ANTHROPIC_API_KEY secret on the Worker — then this drafts full grant narratives from the evidence on the left.</p>
          ) : (
            <Form method="post" className="mt-3 space-y-3">
              <input type="hidden" name="intent" value="draft" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input name="funder" required placeholder="Funder (e.g. Petco Love)" className={`${inputCls} w-full`} />
                <input name="amount" placeholder="Amount (e.g. $10,000)" className={`${inputCls} w-full`} />
              </div>
              <input name="focus" placeholder="Program / use of funds (e.g. senior medical fund, spay-neuter clinic)" className={`${inputCls} w-full`} />
              <textarea name="notes" rows={2} placeholder="Anything the funder should know — history, partnerships, the story behind the ask" className={`${inputCls} w-full`} />
              <button disabled={nav.state !== "idle"} className="rounded-full bg-sky text-white px-6 py-2.5 font-display font-semibold shadow-soft disabled:opacity-50">
                {nav.state !== "idle" ? "Writing (30s or so)…" : "Draft the application"}
              </button>
            </Form>
          )}
        </section>
      </div>

      {drafts.map((d) => (
        <section key={d.id} className="rounded-blob bg-white shadow-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-lg">
              {d.funder} {d.amount && <span className="text-charcoal-soft font-normal text-sm">· {d.amount}</span>}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-charcoal-soft">{String(d.created_at).slice(0, 10)}</span>
              <Form method="post" onSubmit={(e) => { if (!confirm("Delete this draft?")) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="draft_id" value={d.id} />
                <button className="text-xs font-semibold text-terracotta-deep hover:underline">delete</button>
              </Form>
            </div>
          </div>
          {d.focus && <p className="text-sm text-charcoal-soft mt-0.5">{d.focus}</p>}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-semibold text-sky-deep">Read / copy the draft</summary>
            <textarea readOnly defaultValue={d.content} rows={14} className={`${inputCls} w-full mt-2 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
            <div className="mt-3 rounded-2xl bg-cream p-4">
              <Markdown text={d.content} className="text-sm" />
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
