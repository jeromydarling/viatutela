import { Form, Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { PawDoodle } from "../../components/doodles";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Dashboard — Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = user.org_id;

  const [counts, apps, fosters, donations30, tasks, recentAnimals, medicalDue] = await Promise.all([
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM animals WHERE org_id = ?1) animals,
        (SELECT COUNT(*) FROM animals WHERE org_id = ?1 AND status = 'available') available,
        (SELECT COUNT(*) FROM contacts WHERE org_id = ?1) contacts,
        (SELECT COUNT(*) FROM adoptions WHERE org_id = ?1) adoptions`,
    ).bind(org).first<{ animals: number; available: number; contacts: number; adoptions: number }>(),
    env.DB.prepare(
      `SELECT a.id, a.name, a.email, a.status, a.created_at, an.name animal_name, an.id animal_id
       FROM applications a LEFT JOIN animals an ON an.id = a.animal_id
       WHERE a.org_id = ? AND a.status = 'new' ORDER BY a.created_at DESC LIMIT 5`,
    ).bind(org).all<Record<string, string>>(),
    env.DB.prepare(
      `SELECT COUNT(*) n FROM foster_assignments WHERE org_id = ? AND active = 1`,
    ).bind(org).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) total, COUNT(*) n FROM donations
       WHERE org_id = ? AND date >= date('now', '-30 days')`,
    ).bind(org).first<{ total: number; n: number }>(),
    env.DB.prepare(
      `SELECT t.id, t.title, t.due_date, t.done, a.name animal_name, a.id animal_id
       FROM tasks t LEFT JOIN animals a ON a.id = t.animal_id
       WHERE t.org_id = ? AND t.done = 0 ORDER BY t.due_date IS NULL, t.due_date LIMIT 8`,
    ).bind(org).all<Record<string, string>>(),
    env.DB.prepare(
      `SELECT id, name, species, status FROM animals WHERE org_id = ? ORDER BY created_at DESC LIMIT 5`,
    ).bind(org).all<Record<string, string>>(),
    env.DB.prepare(
      `SELECT m.id, m.type, m.description, m.due_date, a.name animal_name, a.id animal_id
       FROM medical_records m JOIN animals a ON a.id = m.animal_id
       WHERE m.org_id = ? AND m.due_date IS NOT NULL AND m.due_date <= date('now', '+30 days')
         AND a.status NOT IN ('adopted','deceased','transferred')
       ORDER BY m.due_date LIMIT 10`,
    ).bind(org).all<Record<string, string>>(),
  ]);

  // getting-started state (cheap; only matters for young orgs)
  const setup = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM pages WHERE org_id = ?1 AND status = 'published') published_pages,
      (SELECT COUNT(*) FROM pages WHERE org_id = ?1) total_pages,
      (SELECT brand_json IS NOT NULL FROM orgs WHERE id = ?1) brand_set,
      (SELECT COUNT(*) FROM animals WHERE org_id = ?1 AND is_public = 1) public_animals`,
  ).bind(org).first<{ published_pages: number; total_pages: number; brand_set: number; public_animals: number }>();

  return {
    setup: setup ?? { published_pages: 0, total_pages: 0, brand_set: 0, public_animals: 0 },
    orgSlug: user.slug,
    counts: counts ?? { animals: 0, available: 0, contacts: 0, adoptions: 0 },
    newApplications: apps.results,
    activeFosters: fosters?.n ?? 0,
    donations30: donations30 ?? { total: 0, n: 0 },
    tasks: tasks.results,
    recentAnimals: recentAnimals.results,
    medicalDue: medicalDue.results,
    today: new Date().toISOString().slice(0, 10),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add-task") {
    const title = String(form.get("title") ?? "").trim();
    if (title) {
      await env.DB.prepare(
        `INSERT INTO tasks (id, org_id, title, due_date) VALUES (?, ?, ?, ?)`,
      )
        .bind(newId("tk"), user.org_id, title, String(form.get("due_date") || "") || null)
        .run();
    }
  }
  if (intent === "complete-task") {
    await env.DB.prepare(`UPDATE tasks SET done = 1 WHERE id = ? AND org_id = ?`)
      .bind(String(form.get("task_id")), user.org_id)
      .run();
  }
  if (intent === "clear-due") {
    await env.DB.prepare(`UPDATE medical_records SET due_date = NULL WHERE id = ? AND org_id = ?`)
      .bind(String(form.get("record_id")), user.org_id)
      .run();
  }
  return null;
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { counts, newApplications, activeFosters, donations30, tasks, recentAnimals, medicalDue, today, setup, orgSlug } = loaderData;

  const steps: { done: boolean; label: string; to: string; hint: string }[] = [
    {
      done: counts.animals > 0,
      label: "Welcome your first friend",
      to: "/app/animals/new",
      hint: "Add one animal — or snap intake photos and let AI draft the profile.",
    },
    {
      done: Boolean(setup.brand_set),
      label: "Make it yours in the Brand Studio",
      to: "/app/brand",
      hint: "Colors, a typeset wordmark, and a site theme — three answers and AI proposes the lot.",
    },
    {
      done: setup.published_pages > 0,
      label: "Publish your website",
      to: "/app/website",
      hint: `${setup.total_pages > 0 ? "Six pages are already drafted and waiting" : "Starter pages are one click away"} — open, tweak, publish.`,
    },
    {
      done: setup.public_animals > 0 && counts.animals > 0,
      label: "Put a friend on the adoption page",
      to: counts.animals > 0 ? "/app/animals" : "/app/animals/new",
      hint: "The 🌐 toggle on any profile — website, adoption page, and Petfinder feed all at once.",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const showChecklist = doneCount < steps.length;

  return (
    <div className="space-y-8">
      {showChecklist && (
        <section className="rounded-blob bg-sunflower-soft/70 border-2 border-sunflower shadow-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-xl">🌻 Getting settled — {doneCount} of {steps.length}</h2>
            <a href={`/adopt/${orgSlug}`} className="text-sm font-semibold text-meadow-deep hover:underline">
              Peek at your public adoption page ↗
            </a>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
            <div className="h-full bg-meadow rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-4 grid sm:grid-cols-2 gap-3">
            {steps.map((s) => (
              <li key={s.label}>
                <Link
                  to={s.to}
                  className={`block rounded-2xl p-3.5 transition-shadow ${s.done ? "bg-white/60 opacity-70" : "bg-white shadow-soft hover:shadow-lift"}`}
                >
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? "bg-meadow text-white" : "bg-cream text-charcoal-soft"}`}>
                      {s.done ? "✓" : "→"}
                    </span>
                    <span className={s.done ? "line-through decoration-2 decoration-meadow/40" : ""}>{s.label}</span>
                  </span>
                  {!s.done && <span className="mt-1 block text-xs text-charcoal-soft">{s.hint}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          ["friends in care", counts.animals],
          ["ready for homes", counts.available],
          ["people", counts.contacts],
          ["adoptions", counts.adoptions],
          ["active fosters", activeFosters],
          [`raised (30d)`, fmtMoney(donations30.total)],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-blob bg-white shadow-soft p-4 text-center">
            <div className="text-2xl font-display font-bold text-meadow-deep">
              {typeof n === "number" ? n.toLocaleString() : n}
            </div>
            <div className="text-xs font-semibold text-charcoal-soft">{label}</div>
          </div>
        ))}
      </div>

      {medicalDue.length > 0 && (
        <section className="rounded-blob bg-white shadow-soft p-6 border-2 border-sunflower">
          <h2 className="font-display font-semibold text-xl">Coming up — vaccines & care</h2>
          <ul className="mt-3 divide-y divide-cream">
            {medicalDue.map((m) => {
              const overdue = m.due_date <= today;
              return (
                <li key={m.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                      overdue ? "bg-terracotta/20 text-terracotta-deep" : "bg-sunflower-soft"
                    }`}
                  >
                    {overdue ? `overdue · ${m.due_date}` : m.due_date}
                  </span>
                  <Link to={`/app/animals/${m.animal_id}`} className="font-semibold hover:underline">
                    {m.animal_name}
                  </Link>
                  <span className="flex-1 truncate text-charcoal-soft">
                    {[m.type, m.description].filter(Boolean).join(" — ")}
                  </span>
                  <Form method="post">
                    <input type="hidden" name="intent" value="clear-due" />
                    <input type="hidden" name="record_id" value={m.id} />
                    <button className="text-xs font-semibold text-meadow-deep hover:underline whitespace-nowrap">
                      mark handled
                    </button>
                  </Form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-blob bg-white shadow-soft p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-xl">New applications</h2>
            <Link to="/app/applications" className="text-sm font-semibold text-meadow-deep hover:underline">
              See all
            </Link>
          </div>
          {newApplications.length === 0 ? (
            <p className="mt-4 text-charcoal-soft">
              Nothing waiting — every application has been answered.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-cream">
              {newApplications.map((a) => (
                <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{a.name}</div>
                    <div className="text-sm text-charcoal-soft truncate">
                      wants to adopt {a.animal_name ?? "any friend"}
                    </div>
                  </div>
                  <Link
                    to="/app/applications"
                    className="shrink-0 rounded-full bg-sunflower px-3 py-1.5 text-sm font-semibold"
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-xl">To-do</h2>
          <Form method="post" className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="add-task" />
            <input
              name="title"
              placeholder="Add something to remember…"
              required
              className="flex-1 min-w-40 rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm focus:border-meadow outline-none"
            />
            <input
              name="due_date"
              type="date"
              className="rounded-xl border-2 border-cream bg-cream px-2 py-2 text-sm focus:border-meadow outline-none"
            />
            <button className="rounded-full bg-meadow text-white px-4 text-sm font-semibold">
              Add
            </button>
          </Form>
          {tasks.length === 0 ? (
            <p className="mt-4 text-charcoal-soft">All caught up. Go give someone a belly rub.</p>
          ) : (
            <ul className="mt-3 divide-y divide-cream">
              {tasks.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center gap-3">
                  <Form method="post">
                    <input type="hidden" name="intent" value="complete-task" />
                    <input type="hidden" name="task_id" value={t.id} />
                    <button
                      aria-label={`Mark "${t.title}" done`}
                      className="w-6 h-6 rounded-full border-2 border-meadow hover:bg-meadow/20"
                    />
                  </Form>
                  <span className="flex-1">{t.title}</span>
                  {t.animal_name && (
                    <Link to={`/app/animals/${t.animal_id}`} className="text-sm text-sky-deep font-semibold">
                      {t.animal_name}
                    </Link>
                  )}
                  {t.due_date && <span className="text-sm text-charcoal-soft">{t.due_date}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-xl">Newest friends</h2>
          <Link
            to="/app/animals/new"
            className="rounded-full bg-sunflower px-4 py-2 text-sm font-display font-semibold shadow-soft"
          >
            + Add a friend
          </Link>
        </div>
        {recentAnimals.length === 0 ? (
          <div className="mt-6 text-center py-8">
            <PawDoodle className="w-14 h-14 mx-auto text-sunflower" />
            <p className="mt-3 font-semibold">
              No friends here yet — add your first companion to get started.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {recentAnimals.map((a) => (
              <Link
                key={a.id}
                to={`/app/animals/${a.id}`}
                className="rounded-full bg-cream px-4 py-2 text-sm font-semibold hover:bg-sunflower-soft transition-colors"
              >
                {a.name} <span className="text-charcoal-soft">· {a.species ?? "friend"} · {a.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
