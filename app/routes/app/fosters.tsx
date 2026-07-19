import { Form, Link } from "react-router";
import type { Route } from "./+types/fosters";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fosters — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const [active, past, animals, fosterFolk] = await Promise.all([
    env.DB.prepare(
      `SELECT fa.*, a.name animal_name, a.species, c.name contact_name, c.phone, c.email
       FROM foster_assignments fa
       JOIN animals a ON a.id = fa.animal_id
       JOIN contacts c ON c.id = fa.contact_id
       WHERE fa.org_id = ? AND fa.active = 1 ORDER BY fa.start_date DESC`,
    ).bind(user.org_id).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT fa.*, a.name animal_name, c.name contact_name
       FROM foster_assignments fa
       JOIN animals a ON a.id = fa.animal_id
       JOIN contacts c ON c.id = fa.contact_id
       WHERE fa.org_id = ? AND fa.active = 0 ORDER BY fa.end_date DESC LIMIT 25`,
    ).bind(user.org_id).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT id, name FROM animals WHERE org_id = ? AND status NOT IN ('adopted','deceased','transferred') ORDER BY name`,
    ).bind(user.org_id).all<{ id: string; name: string }>(),
    env.DB.prepare(
      `SELECT id, name FROM contacts WHERE org_id = ? ORDER BY (roles LIKE '%foster%') DESC, name LIMIT 500`,
    ).bind(user.org_id).all<{ id: string; name: string }>(),
  ]);
  return {
    active: active.results,
    past: past.results,
    animals: animals.results,
    fosterFolk: fosterFolk.results,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));

  if (intent === "assign") {
    const animalId = String(f.get("animal_id") ?? "");
    const contactId = String(f.get("contact_id") ?? "");
    if (!animalId || !contactId) return { error: "Pick both a friend and a foster." };
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO foster_assignments (id, org_id, animal_id, contact_id, start_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(
        newId("fa"), user.org_id, animalId, contactId,
        String(f.get("start_date") || "") || new Date().toISOString().slice(0, 10),
        String(f.get("notes") || "") || null,
      ),
      env.DB.prepare(`UPDATE animals SET status = 'in foster' WHERE id = ? AND org_id = ?`).bind(animalId, user.org_id),
    ]);
    return { ok: "Foster stay started." };
  }

  if (intent === "end") {
    const id = String(f.get("assignment_id") ?? "");
    const fa = await env.DB.prepare(
      `SELECT animal_id FROM foster_assignments WHERE id = ? AND org_id = ?`,
    ).bind(id, user.org_id).first<{ animal_id: string }>();
    if (fa) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE foster_assignments SET active = 0, end_date = date('now') WHERE id = ?`).bind(id),
        env.DB.prepare(`UPDATE animals SET status = 'available' WHERE id = ? AND status = 'in foster'`).bind(fa.animal_id),
      ]);
    }
    return { ok: "Foster stay ended — welcome back." };
  }
  return null;
}

const inputCls =
  "rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none";

export default function Fosters({ loaderData, actionData }: Route.ComponentProps) {
  const { active, past, animals, fosterFolk } = loaderData;

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold">Foster care ({active.length} active)</h1>

      {(actionData?.ok || actionData?.error) && (
        <p className={`mt-3 rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}>
          {actionData.error ?? actionData.ok}
        </p>
      )}

      <Form method="post" className="mt-5 rounded-blob bg-white shadow-soft p-6 flex flex-wrap gap-3 items-end">
        <input type="hidden" name="intent" value="assign" />
        <label className="block">
          <span className="font-semibold text-sm">Friend</span>
          <select name="animal_id" required className={`${inputCls} block mt-1`}>
            <option value="">Choose…</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold text-sm">Foster home</span>
          <select name="contact_id" required className={`${inputCls} block mt-1`}>
            <option value="">Choose…</option>
            {fosterFolk.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold text-sm">Start</span>
          <input name="start_date" type="date" className={`${inputCls} block mt-1`} />
        </label>
        <label className="block flex-1 min-w-40">
          <span className="font-semibold text-sm">Notes</span>
          <input name="notes" placeholder="Food, meds, quirks…" className={`${inputCls} block mt-1 w-full`} />
        </label>
        <button className="rounded-full bg-meadow text-white px-6 py-2.5 font-display font-semibold shadow-soft">
          Start foster stay
        </button>
      </Form>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {active.map((fa) => (
          <div key={String(fa.id)} className="rounded-blob bg-white shadow-soft p-5">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/app/animals/${fa.animal_id}`} className="font-display font-semibold text-lg hover:underline">
                {String(fa.animal_name)}
              </Link>
              <span className="text-xs font-semibold rounded-full bg-meadow/20 text-meadow-deep px-2 py-1">
                since {String(fa.start_date ?? "—")}
              </span>
            </div>
            <p className="mt-1 text-sm">
              with <strong>{String(fa.contact_name)}</strong>
              {fa.phone ? ` · ${fa.phone}` : ""}{fa.email ? ` · ${fa.email}` : ""}
            </p>
            {Boolean(fa.notes) && <p className="mt-2 text-sm text-charcoal-soft italic">{String(fa.notes)}</p>}
            <Form method="post" className="mt-3">
              <input type="hidden" name="intent" value="end" />
              <input type="hidden" name="assignment_id" value={String(fa.id)} />
              <button className="text-sm font-semibold text-terracotta-deep hover:underline">
                End stay
              </button>
            </Form>
          </div>
        ))}
        {active.length === 0 && (
          <p className="md:col-span-2 rounded-blob bg-white shadow-soft p-10 text-center text-charcoal-soft">
            No friends in foster right now.
          </p>
        )}
      </div>

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="font-display font-semibold cursor-pointer">Past stays ({past.length})</summary>
          <ul className="mt-3 text-sm divide-y divide-cream rounded-blob bg-white shadow-soft p-4">
            {past.map((fa) => (
              <li key={String(fa.id)} className="py-2">
                {String(fa.animal_name)} with {String(fa.contact_name)} · {String(fa.start_date ?? "—")} → {String(fa.end_date ?? "—")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
