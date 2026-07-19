import { Form, Link } from "react-router";
import type { Route } from "./+types/marketing.calendar";
import { requireUser } from "../../lib/auth.server";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Content calendar — Via Tutela" }];
}

function monthOf(param: string | null): string {
  if (param && /^\d{4}-\d{2}$/.test(param)) return param;
  return new Date().toISOString().slice(0, 7);
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const url = new URL(request.url);
  const month = monthOf(url.searchParams.get("m"));

  const assets = await env.DB.prepare(
    `SELECT ma.id, ma.channel, ma.title, ma.scheduled_for, ma.posted_at, ma.campaign_id, mc.name campaign_name
     FROM marketing_assets ma JOIN marketing_campaigns mc ON mc.id = ma.campaign_id
     WHERE ma.org_id = ? AND ma.scheduled_for LIKE ? ORDER BY ma.scheduled_for`,
  )
    .bind(user.org_id, `${month}%`)
    .all<Record<string, unknown>>();

  const unscheduled = await env.DB.prepare(
    `SELECT ma.id, ma.channel, ma.title, ma.campaign_id, mc.name campaign_name
     FROM marketing_assets ma JOIN marketing_campaigns mc ON mc.id = ma.campaign_id
     WHERE ma.org_id = ? AND ma.scheduled_for IS NULL AND ma.posted_at IS NULL
     ORDER BY ma.created_at DESC LIMIT 30`,
  )
    .bind(user.org_id)
    .all<Record<string, unknown>>();

  return { month, assets: assets.results, unscheduled: unscheduled.results };
}

export async function action({ context, request }: Route.ActionArgs) {
  const { env, user } = await requireUser(context, request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const id = String(f.get("asset_id") ?? "");

  if (intent === "move") {
    const date = String(f.get("date") ?? "");
    await env.DB.prepare(`UPDATE marketing_assets SET scheduled_for = ? WHERE id = ? AND org_id = ?`)
      .bind(/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, id, user.org_id)
      .run();
    return { ok: "Moved." };
  }
  if (intent === "mark-posted") {
    await env.DB.prepare(`UPDATE marketing_assets SET posted_at = ? WHERE id = ? AND org_id = ?`)
      .bind(new Date().toISOString(), id, user.org_id)
      .run();
    return { ok: "Posted — nice." };
  }
  return null;
}

const CHANNEL_EMOJI: Record<string, string> = {
  facebook: "📘", instagram: "📸", story: "🎞️", reel: "🎬", x: "✖️",
  pinterest: "📌", email: "✉️", blog: "📝", press: "📰", google_ads: "🔎", meta_ads: "📣",
};

export default function ContentCalendar({ loaderData, actionData }: Route.ComponentProps) {
  const { month, assets, unscheduled } = loaderData;
  const a = actionData as { ok?: string } | undefined;

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const startPad = first.getUTCDay();
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const monthLabel = first.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const today = new Date().toISOString().slice(0, 10);

  const byDay = new Map<string, typeof assets>();
  for (const asset of assets) {
    const d = String(asset.scheduled_for);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(asset);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/app/marketing" className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">← Marketing Studio</Link>
          <h1 className="text-2xl font-display font-semibold">Content calendar</h1>
        </div>
        <div className="flex items-center gap-2 font-display font-semibold">
          <Link to={`?m=${prev}`} className="rounded-full bg-white shadow-soft px-4 py-2 text-sm hover:bg-sunflower-soft">←</Link>
          <span className="px-2">{monthLabel}</span>
          <Link to={`?m=${next}`} className="rounded-full bg-white shadow-soft px-4 py-2 text-sm hover:bg-sunflower-soft">→</Link>
        </div>
      </div>

      {a?.ok && <p className="rounded-2xl bg-meadow/15 text-meadow-deep px-4 py-2.5 font-semibold">{a.ok}</p>}

      <div className="rounded-blob bg-white shadow-soft p-4 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1.5 min-w-[760px]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-bold text-charcoal-soft py-1">{d}</div>
          ))}
          {Array.from({ length: startPad }, (_, i) => (
            <div key={`pad${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const day = byDay.get(date) ?? [];
            return (
              <div key={date} className={`rounded-xl border-2 p-1.5 min-h-24 ${date === today ? "border-sunflower bg-sunflower-soft/40" : "border-cream"}`}>
                <div className="text-xs font-bold text-charcoal-soft">{i + 1}</div>
                {day.map((asset) => (
                  <div key={String(asset.id)} className={`mt-1 rounded-lg px-1.5 py-1 text-[11px] leading-tight ${asset.posted_at ? "bg-meadow/15 text-meadow-deep" : "bg-sky/15 text-sky-deep"}`}>
                    <Link to={`/app/marketing/${asset.campaign_id}`} className="font-semibold hover:underline block truncate" title={`${asset.campaign_name}: ${asset.title ?? ""}`}>
                      {CHANNEL_EMOJI[String(asset.channel)] ?? "•"} {String(asset.title ?? asset.channel)}
                    </Link>
                    {!asset.posted_at && (
                      <div className="mt-0.5 flex items-center gap-1">
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="mark-posted" />
                          <input type="hidden" name="asset_id" value={String(asset.id)} />
                          <button className="hover:underline">✓ posted</button>
                        </Form>
                        <Form method="post" className="inline-flex items-center gap-0.5">
                          <input type="hidden" name="intent" value="move" />
                          <input type="hidden" name="asset_id" value={String(asset.id)} />
                          <input type="date" name="date" defaultValue={date} className="w-5 opacity-60" aria-label="Move to date" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
                        </Form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <section className="rounded-blob bg-white shadow-soft p-6">
          <h2 className="font-display font-semibold text-lg">Not on the calendar yet</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {unscheduled.map((asset) => (
              <li key={String(asset.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream px-4 py-2">
                <Link to={`/app/marketing/${asset.campaign_id}`} className="font-semibold hover:underline truncate">
                  {CHANNEL_EMOJI[String(asset.channel)] ?? "•"} {String(asset.title ?? asset.channel)}{" "}
                  <span className="text-xs text-charcoal-soft font-normal">({String(asset.campaign_name)})</span>
                </Link>
                <Form method="post" className="flex items-center gap-2">
                  <input type="hidden" name="intent" value="move" />
                  <input type="hidden" name="asset_id" value={String(asset.id)} />
                  <input type="date" name="date" required className="rounded-lg border-2 border-white bg-white px-2 py-1 text-xs" />
                  <button className="rounded-full bg-sunflower px-3 py-1 text-xs font-semibold shadow-soft">Schedule</button>
                </Form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
