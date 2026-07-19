import { Form, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/applications";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { sendAppEmail } from "../../../workers/lib/email";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Applications — Via Tutela" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "new";

  let sql = `SELECT ap.*, an.name animal_name, an.status animal_status
    FROM applications ap LEFT JOIN animals an ON an.id = ap.animal_id
    WHERE ap.org_id = ?`;
  const binds: unknown[] = [user.org_id];
  if (status !== "all") {
    sql += ` AND ap.status = ?`;
    binds.push(status);
  }
  sql += ` ORDER BY ap.created_at DESC LIMIT 200`;
  const apps = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();

  const counts = await env.DB.prepare(
    `SELECT status, COUNT(*) n FROM applications WHERE org_id = ? GROUP BY status`,
  ).bind(user.org_id).all<{ status: string; n: number }>();

  return {
    applications: apps.results,
    counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])),
    filter: status,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, ctx, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const appId = String(f.get("application_id") ?? "");

  const app = await env.DB.prepare(
    `SELECT * FROM applications WHERE id = ? AND org_id = ?`,
  ).bind(appId, user.org_id).first<Record<string, unknown>>();
  if (!app) return { error: "Application not found." };

  const org = await env.DB.prepare(`SELECT name, email FROM orgs WHERE id = ?`)
    .bind(user.org_id)
    .first<{ name: string; email: string | null }>();
  const animalName = app.animal_id
    ? (await env.DB.prepare(`SELECT name FROM animals WHERE id = ?`)
        .bind(app.animal_id)
        .first<{ name: string }>())?.name ?? "our friend"
    : "our friend";

  if (intent === "deny") {
    await env.DB.prepare(
      `UPDATE applications SET status = 'denied', decided_at = datetime('now') WHERE id = ?`,
    ).bind(appId).run();
    ctx.waitUntil(
      sendAppEmail(env, {
        to: String(app.email),
        subject: `About your application to ${org?.name ?? "the rescue"}`,
        heading: `Thank you for asking about ${animalName}`,
        paragraphs: [
          `${String(app.name)}, thank you truly for offering your home.`,
          `This time it wasn't the right match for ${animalName}, but that takes nothing away from your kindness. There are many friends still looking — we hope you'll keep an open door.`,
        ],
        ...(org?.email ? { replyTo: org.email } : {}),
      }),
    );
    return { ok: "Marked as denied — a gentle note is on its way to them." };
  }

  if (intent === "approve") {
    // create/find the adopter as a contact, record the adoption, mark the animal
    const stmts: D1PreparedStatement[] = [
      env.DB.prepare(
        `UPDATE applications SET status = 'approved', decided_at = datetime('now') WHERE id = ?`,
      ).bind(appId),
    ];

    let contactId: string | null = null;
    const existing = await env.DB.prepare(
      `SELECT id, roles FROM contacts WHERE org_id = ? AND email = ?`,
    ).bind(user.org_id, app.email).first<{ id: string; roles: string | null }>();
    if (existing) {
      contactId = existing.id;
      const roles = new Set((existing.roles ?? "").split(",").filter(Boolean));
      roles.add("adopter");
      stmts.push(
        env.DB.prepare(`UPDATE contacts SET roles = ? WHERE id = ?`).bind([...roles].join(","), existing.id),
      );
    } else {
      contactId = newId("ct");
      stmts.push(
        env.DB.prepare(
          `INSERT INTO contacts (id, org_id, name, email, phone, roles) VALUES (?, ?, ?, ?, ?, 'adopter')`,
        ).bind(contactId, user.org_id, app.name, app.email, app.phone ?? null),
      );
    }

    if (app.animal_id) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO adoptions (id, org_id, animal_id, contact_id, date, status) VALUES (?, ?, ?, ?, date('now'), 'completed')`,
        ).bind(newId("ad"), user.org_id, app.animal_id, contactId),
        env.DB.prepare(`UPDATE animals SET status = 'adopted' WHERE id = ? AND org_id = ?`).bind(app.animal_id, user.org_id),
        env.DB.prepare(
          `UPDATE foster_assignments SET active = 0, end_date = date('now') WHERE animal_id = ? AND active = 1`,
        ).bind(app.animal_id),
      );
    }
    await env.DB.batch(stmts);
    ctx.waitUntil(
      sendAppEmail(env, {
        to: String(app.email),
        subject: `Wonderful news about ${animalName} 🏡`,
        heading: `${animalName} is coming home with you`,
        paragraphs: [
          `${String(app.name)}, your application was approved!`,
          `${org?.name ?? "The rescue"} will be in touch with the next steps. Thank you for giving ${animalName} a way home.`,
        ],
        ...(org?.email ? { replyTo: org.email } : {}),
      }),
    );
    return { ok: "Approved! Adoption recorded, adopter added, and the happy email is on its way." };
  }
  return null;
}

const TABS = [
  ["new", "New"],
  ["approved", "Approved"],
  ["denied", "Denied"],
  ["all", "All"],
] as const;

export default function Applications({ loaderData, actionData }: Route.ComponentProps) {
  const { applications, counts, filter } = loaderData;
  const [, setParams] = useSearchParams();

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold">Adoption applications</h1>

      <div className="mt-4 flex gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setParams(key === "new" ? {} : { status: key })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              filter === key ? "bg-sunflower" : "bg-white shadow-soft text-charcoal-soft hover:bg-sunflower-soft"
            }`}
          >
            {label}
            {key !== "all" && counts[key] ? ` (${counts[key]})` : ""}
          </button>
        ))}
      </div>

      {(actionData?.ok || actionData?.error) && (
        <p className={`mt-4 rounded-2xl px-4 py-2.5 font-semibold ${actionData.error ? "bg-terracotta/15 text-terracotta-deep" : "bg-meadow/15 text-meadow-deep"}`}>
          {actionData.error ?? actionData.ok}
        </p>
      )}

      {applications.length === 0 ? (
        <p className="mt-8 rounded-blob bg-white shadow-soft p-10 text-center text-charcoal-soft">
          Nothing here right now. Share your adoption page to invite applications.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {applications.map((a) => (
            <div key={String(a.id)} className="rounded-blob bg-white shadow-soft p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display font-semibold text-lg">{String(a.name)}</div>
                  <div className="text-sm text-charcoal-soft">
                    {String(a.email)}{a.phone ? ` · ${a.phone}` : ""}{a.home_type ? ` · ${a.home_type}` : ""}
                  </div>
                  <div className="mt-1 text-sm">
                    wants to adopt{" "}
                    {a.animal_id ? (
                      <Link to={`/app/animals/${a.animal_id}`} className="font-semibold text-meadow-deep hover:underline">
                        {String(a.animal_name)}
                      </Link>
                    ) : (
                      <em>any friend</em>
                    )}
                    {a.animal_status === "adopted" && a.status === "new" && (
                      <span className="ml-2 rounded-full bg-terracotta/20 text-terracotta-deep text-xs font-semibold px-2 py-0.5">
                        already adopted
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-charcoal-soft">
                  {String(a.created_at)}
                  <div className={`mt-1 inline-block rounded-full px-2 py-0.5 font-semibold ${
                    a.status === "new" ? "bg-sunflower-soft" : a.status === "approved" ? "bg-meadow/20 text-meadow-deep" : "bg-charcoal/10"
                  }`}>
                    {String(a.status)}
                  </div>
                </div>
              </div>
              {Boolean(a.message) && (
                <blockquote className="mt-3 rounded-2xl bg-cream p-4 text-sm italic">{String(a.message)}</blockquote>
              )}
              {a.status === "new" && (
                <div className="mt-4 flex gap-3">
                  <Form method="post">
                    <input type="hidden" name="application_id" value={String(a.id)} />
                    <button
                      name="intent"
                      value="approve"
                      className="rounded-full bg-meadow text-white px-5 py-2 text-sm font-display font-semibold shadow-soft"
                    >
                      Approve & record adoption
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="application_id" value={String(a.id)} />
                    <button
                      name="intent"
                      value="deny"
                      className="rounded-full border-2 border-terracotta text-terracotta-deep px-5 py-2 text-sm font-semibold hover:bg-terracotta hover:text-white transition-colors"
                    >
                      Deny
                    </button>
                  </Form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
