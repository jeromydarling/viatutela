import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/volunteers";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Volunteers — Tutela" }];
}

function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 2;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const h = eh + em / 60 - (sh + sm / 60);
  return h > 0 && h < 24 ? Math.round(h * 10) / 10 : 2;
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const [shifts, volunteers, stats, top, signups] = await Promise.all([
    env.DB.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM shift_signups g WHERE g.shift_id = s.id) filled
       FROM shifts s WHERE s.org_id = ? AND s.date >= date('now','-1 day') ORDER BY s.date, s.start_time LIMIT 40`,
    ).bind(user.org_id).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT id, name FROM contacts WHERE org_id = ? AND roles LIKE '%volunteer%' ORDER BY name LIMIT 300`)
      .bind(user.org_id).all<{ id: string; name: string }>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(hours),0) total, COUNT(DISTINCT contact_id) people
       FROM shift_signups WHERE org_id = ? AND created_at >= datetime('now','-12 months')`,
    ).bind(user.org_id).first<{ total: number; people: number }>(),
    env.DB.prepare(
      `SELECT c.name, ROUND(SUM(g.hours),1) h FROM shift_signups g JOIN contacts c ON c.id = g.contact_id
       WHERE g.org_id = ? AND g.created_at >= datetime('now','-12 months')
       GROUP BY g.contact_id ORDER BY h DESC LIMIT 5`,
    ).bind(user.org_id).all<{ name: string; h: number }>(),
    env.DB.prepare(
      `SELECT g.id, g.shift_id, c.name FROM shift_signups g JOIN contacts c ON c.id = g.contact_id
       WHERE g.org_id = ? ORDER BY g.created_at LIMIT 400`,
    ).bind(user.org_id).all<{ id: string; shift_id: string; name: string }>(),
  ]);
  return {
    shifts: shifts.results,
    volunteers: volunteers.results,
    signups: signups.results,
    totalHours: stats?.total ?? 0,
    activePeople: stats?.people ?? 0,
    top: top.results,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const str = (k: string) => String(f.get(k) ?? "").trim();

  if (intent === "create-shift") {
    const title = str("title");
    const date = str("date");
    if (!title || !date) return { error: "A shift needs a title and a date." };
    await env.DB.prepare(
      `INSERT INTO shifts (id, org_id, title, date, start_time, end_time, slots, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId("sh"), user.org_id, title.slice(0, 120), date, str("start_time") || null, str("end_time") || null,
        Math.max(1, Math.min(50, Number(f.get("slots")) || 3)), str("notes").slice(0, 300) || null)
      .run();
    return { ok: "Shift added." };
  }

  if (intent === "signup") {
    const shift = await env.DB.prepare(`SELECT start_time, end_time FROM shifts WHERE id = ? AND org_id = ?`)
      .bind(str("shift_id"), user.org_id)
      .first<{ start_time: string | null; end_time: string | null }>();
    if (!shift) return { error: "That shift is gone." };
    const contactId = str("contact_id");
    if (!contactId) return { error: "Pick a volunteer." };
    await env.DB.prepare(
      `INSERT INTO shift_signups (id, org_id, shift_id, contact_id, hours) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(newId("sg"), user.org_id, str("shift_id"), contactId, hoursBetween(shift.start_time, shift.end_time))
      .run();
    return { ok: "Signed up — hours logged automatically for grant season." };
  }

  if (intent === "remove-signup") {
    await env.DB.prepare(`DELETE FROM shift_signups WHERE id = ? AND org_id = ?`).bind(str("signup_id"), user.org_id).run();
    return { ok: "Removed." };
  }

  if (intent === "delete-shift") {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM shift_signups WHERE shift_id = ? AND org_id = ?`).bind(str("shift_id"), user.org_id),
      env.DB.prepare(`DELETE FROM shifts WHERE id = ? AND org_id = ?`).bind(str("shift_id"), user.org_id),
    ]);
    return { ok: "Shift removed." };
  }
  return null;
}

const inputCls = "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

export default function Volunteers({ loaderData, actionData }: Route.ComponentProps) {
  const { shifts, volunteers, signups, totalHours, activePeople, top } = loaderData;
  const nav = useNavigation();
  const a = actionData as { ok?: string; error?: string } | undefined;
  const byShift = new Map<string, typeof signups>();
  for (const s of signups) {
    if (!byShift.has(s.shift_id)) byShift.set(s.shift_id, []);
    byShift.get(s.shift_id)!.push(s);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Volunteers</h1>
        <p className="text-sm text-charcoal-soft">
          Shifts, sign-ups, and the hour log every grant application asks for.
        </p>
      </div>

      {(a?.ok || a?.error) && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${a.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`} role="status">
          {a.error ?? a.ok}
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-blob bg-white shadow-soft p-5 text-center">
          <div className="text-3xl font-display font-bold text-meadow-deep">{Math.round(totalHours)}</div>
          <div className="text-sm font-semibold text-charcoal-soft">volunteer hours (12 mo) — grant gold</div>
        </div>
        <div className="rounded-blob bg-white shadow-soft p-5 text-center">
          <div className="text-3xl font-display font-bold text-meadow-deep">{activePeople}</div>
          <div className="text-sm font-semibold text-charcoal-soft">active volunteers</div>
        </div>
        <div className="rounded-blob bg-white shadow-soft p-5">
          <div className="text-xs font-bold text-charcoal-soft uppercase">Most hours</div>
          {top.length === 0 ? (
            <p className="text-sm text-charcoal-soft mt-1">Log a shift to start the leaderboard.</p>
          ) : (
            <ul className="mt-1 text-sm space-y-0.5">
              {top.map((t) => (
                <li key={t.name} className="flex justify-between"><span>{t.name}</span><strong>{t.h}h</strong></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-semibold text-lg">Your volunteer roster ({volunteers.length})</h2>
          <Link to="/app/people?role=volunteer" className="text-sm font-semibold text-meadow-deep hover:underline">
            Manage in People →
          </Link>
        </div>
        {volunteers.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal-soft">
            Nobody wears the volunteer badge yet. Open{" "}
            <Link to="/app/people" className="font-semibold text-meadow-deep hover:underline">People</Link>{" "}
            and check the <strong>volunteer</strong> role on anyone who helps out — they'll show up
            here and in every shift's sign-up picker.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {volunteers.map((v) => (
              <li key={v.id} className="rounded-full bg-cream px-3 py-1 text-sm font-semibold">
                {v.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">New shift</h2>
        <Form method="post" className="mt-3 flex flex-wrap gap-2 items-end">
          <input type="hidden" name="intent" value="create-shift" />
          <input name="title" required placeholder="Morning kennels, adoption event…" className={`${inputCls} flex-1 min-w-40`} />
          <input name="date" type="date" required className={inputCls} />
          <input name="start_time" type="time" className={inputCls} />
          <input name="end_time" type="time" className={inputCls} />
          <input name="slots" type="number" min={1} max={50} defaultValue={3} className={`${inputCls} w-20`} aria-label="Slots" />
          <button disabled={nav.state !== "idle"} className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-display font-semibold shadow-soft disabled:opacity-50">Add shift</button>
        </Form>
      </section>

      <section className="space-y-3">
        {shifts.length === 0 && (
          <p className="rounded-blob bg-white shadow-soft p-8 text-center text-charcoal-soft">
            No upcoming shifts — add the first one above. Tip: volunteers marked with the ★ role in People appear in the sign-up picker.
          </p>
        )}
        {shifts.map((s) => {
          const list = byShift.get(String(s.id)) ?? [];
          const full = list.length >= Number(s.slots);
          return (
            <div key={String(s.id)} className="rounded-blob bg-white shadow-soft p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold">{String(s.title)}</span>
                <span className="text-sm text-charcoal-soft">
                  {String(s.date)}{s.start_time ? ` · ${s.start_time}–${s.end_time ?? "?"}` : ""}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${full ? "bg-meadow/20 text-meadow-deep" : "bg-sunflower-soft"}`}>
                  {list.length}/{Number(s.slots)} filled
                </span>
                <Form method="post" className="ml-auto" onSubmit={(e) => { if (!confirm("Remove this shift?")) e.preventDefault(); }}>
                  <input type="hidden" name="intent" value="delete-shift" />
                  <input type="hidden" name="shift_id" value={String(s.id)} />
                  <button className="text-xs font-semibold text-terracotta-deep hover:underline">remove</button>
                </Form>
              </div>
              {list.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {list.map((g) => (
                    <li key={g.id} className="rounded-full bg-cream px-3 py-1 text-sm font-semibold flex items-center gap-1.5">
                      {g.name}
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="remove-signup" />
                        <input type="hidden" name="signup_id" value={g.id} />
                        <button aria-label={`Remove ${g.name}`} className="text-terracotta-deep font-bold">✕</button>
                      </Form>
                    </li>
                  ))}
                </ul>
              )}
              {!full && (
                <Form method="post" className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="intent" value="signup" />
                  <input type="hidden" name="shift_id" value={String(s.id)} />
                  <select name="contact_id" required className={`${inputCls} flex-1 min-w-40`}>
                    <option value="">Add a volunteer…</option>
                    {volunteers.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <button className="rounded-full bg-sunflower px-4 py-1.5 text-sm font-semibold shadow-soft">Sign up</button>
                </Form>
              )}
            </div>
          );
        })}
      </section>
      <p className="text-xs text-charcoal-soft">
        Add volunteers in <Link to="/app/people" className="font-semibold text-meadow-deep hover:underline">People</Link> with the "volunteer" role.
      </p>
    </div>
  );
}
