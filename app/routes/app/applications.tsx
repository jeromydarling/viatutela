import { Form, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/applications";
import { requireUser } from "../../lib/auth.server";
import { newId } from "../../../workers/lib/ids";
import { sendAppEmail } from "../../../workers/lib/email";
import { logAiWrite } from "../../../workers/lib/ai";
import { compactAnimal, reviewApplication, type AppReview } from "../../../workers/lib/ai-shelter";
import { autoAdoption } from "../../../workers/lib/marketing-auto";
import { scheduleFollowups } from "../../../workers/lib/lifecycle";
import { sendSms } from "../../../workers/lib/sms";
import { recordAdoptionUsage } from "../../../workers/lib/billing";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Applications — Tutela" }];
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
  const [apps, counts] = await Promise.all([
    env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT status, COUNT(*) n FROM applications WHERE org_id = ? GROUP BY status`,
    ).bind(user.org_id).all<{ status: string; n: number }>(),
  ]);

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

  if (intent === "ai-review") {
    const animalRow = app.animal_id
      ? await env.DB.prepare(`SELECT * FROM animals WHERE id = ? AND org_id = ?`)
          .bind(app.animal_id, user.org_id)
          .first<Record<string, unknown>>()
      : null;
    const othersRows = await env.DB.prepare(
      `SELECT * FROM animals WHERE org_id = ? AND is_public = 1 AND status IN ('available','in foster')
       AND id != COALESCE(?, '') ORDER BY intake_date LIMIT 30`,
    )
      .bind(user.org_id, app.animal_id ?? null)
      .all<Record<string, unknown>>();
    const prior = await env.DB.prepare(
      `SELECT COUNT(*) n FROM adoptions ad JOIN contacts c ON c.id = ad.contact_id
       WHERE ad.org_id = ? AND c.email = ?`,
    )
      .bind(user.org_id, app.email)
      .first<{ n: number }>();

    const res = await reviewApplication(env, {
      application: {
        name: String(app.name),
        email: String(app.email),
        phone: app.phone ? String(app.phone) : null,
        home_type: app.home_type ? String(app.home_type) : null,
        message: app.message ? String(app.message) : null,
        interest: app.interest ? String(app.interest) : null,
      },
      animal: animalRow ? compactAnimal(animalRow) : null,
      others: othersRows.results.map((r) => compactAnimal(r)),
      priorAdoptions: prior?.n ?? 0,
    });
    if (res.error || !res.review) return { error: res.error ?? "The AI review didn't come back." };
    await env.DB.prepare(`UPDATE applications SET ai_review_json = ? WHERE id = ?`)
      .bind(JSON.stringify(res.review), appId)
      .run();
    ctx.waitUntil(logAiWrite(env, user.org_id, user.user_id, "application_review", `application ${appId} scored ${res.review.fit_score}`));
    return { ok: `AI review ready for ${String(app.name)}.` };
  }

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

    const adoptionId = newId("ad");
    if (app.animal_id) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO adoptions (id, org_id, animal_id, contact_id, date, status) VALUES (?, ?, ?, ?, date('now'), 'completed')`,
        ).bind(adoptionId, user.org_id, app.animal_id, contactId),
        env.DB.prepare(`UPDATE animals SET status = 'adopted' WHERE id = ? AND org_id = ?`).bind(app.animal_id, user.org_id),
        env.DB.prepare(
          `UPDATE foster_assignments SET active = 0, end_date = date('now') WHERE animal_id = ? AND active = 1`,
        ).bind(app.animal_id),
      );
    }
    await env.DB.batch(stmts);
    if (app.animal_id) {
      ctx.waitUntil(autoAdoption(env, user.org_id, String(app.animal_id)));
      ctx.waitUntil(scheduleFollowups(env, user.org_id, adoptionId));
      ctx.waitUntil(recordAdoptionUsage(env, user.org_id, adoptionId));
    }
    if (app.phone) {
      ctx.waitUntil(
        sendSms(env, String(app.phone), `🏡 Wonderful news — your application for ${animalName} was approved! ${org?.name ?? "The rescue"} will be in touch with next steps.`),
      );
    }
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

function parseReview(raw: unknown): AppReview | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw) as AppReview;
  } catch {
    return null;
  }
}

function ReviewCard({ review }: { review: AppReview }) {
  const scoreTone =
    review.fit_score >= 70
      ? "bg-meadow/20 text-meadow-deep"
      : review.fit_score >= 40
        ? "bg-sunflower-soft text-charcoal"
        : "bg-terracotta/20 text-terracotta-deep";
  return (
    <div className="mt-3 rounded-2xl border-2 border-sky/30 bg-sky/5 p-4 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`rounded-full px-2.5 py-1 font-display font-bold ${scoreTone}`}>fit {review.fit_score}/100</span>
        <span className="text-xs text-charcoal-soft">AI review · staff decide, always</span>
      </div>
      <p className="mt-2">{review.summary}</p>
      {(review.green_flags.length > 0 || review.red_flags.length > 0) && (
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          {review.green_flags.length > 0 && (
            <ul className="space-y-1">
              {review.green_flags.map((g) => (
                <li key={g} className="text-meadow-deep">✓ {g}</li>
              ))}
            </ul>
          )}
          {review.red_flags.length > 0 && (
            <ul className="space-y-1">
              {review.red_flags.map((r) => (
                <li key={r} className="text-terracotta-deep">⚑ {r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {review.better_fits.length > 0 && (
        <div className="mt-2">
          <span className="font-semibold">Possibly better fits: </span>
          {review.better_fits.map((b, i) => (
            <span key={b.animal_id}>
              {i > 0 && " · "}
              <Link to={`/app/animals/${b.animal_id}`} className="font-semibold text-sky-deep hover:underline" title={b.reason}>
                {b.name}
              </Link>
            </span>
          ))}
        </div>
      )}
      {review.draft_reply && (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-sky-deep">Draft reply (copy & edit)</summary>
          <textarea
            readOnly
            defaultValue={review.draft_reply}
            rows={6}
            className="mt-2 w-full rounded-xl border-2 border-cream bg-white p-3 text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
        </details>
      )}
    </div>
  );
}

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
                    {a.interest === "meet"
                      ? "wants to meet"
                      : a.interest === "foster_to_adopt"
                        ? "wants to foster-to-adopt"
                        : a.interest === "question"
                          ? "has a question about"
                          : "wants to adopt"}{" "}
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
              {(() => {
                const review = parseReview(a.ai_review_json);
                return review ? <ReviewCard review={review} /> : null;
              })()}
              {a.status === "new" && (
                <div className="mt-4 flex flex-wrap gap-3">
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
                  <Form method="post">
                    <input type="hidden" name="application_id" value={String(a.id)} />
                    <button
                      name="intent"
                      value="ai-review"
                      className="rounded-full border-2 border-sky text-sky-deep px-5 py-2 text-sm font-semibold hover:bg-sky hover:text-white transition-colors"
                    >
                      {a.ai_review_json ? "Re-run AI review" : "✨ AI review"}
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
