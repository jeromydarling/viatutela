import type { Route } from "./+types/reports";
import { requireUser } from "../../lib/auth.server";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Reports — Via Tutela" }];
}

interface MonthRow {
  m: string;
  n: number;
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const org = user.org_id;

  const [
    intakes,
    adoptions,
    donations,
    byStatus,
    bySpecies,
    byLocation,
    stay,
    funnel,
    totals,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT strftime('%Y-%m', intake_date) m, COUNT(*) n FROM animals
       WHERE org_id = ? AND intake_date >= date('now', '-11 months', 'start of month')
       GROUP BY m ORDER BY m`,
    ).bind(org).all<MonthRow>(),
    env.DB.prepare(
      `SELECT strftime('%Y-%m', date) m, COUNT(*) n FROM adoptions
       WHERE org_id = ? AND date >= date('now', '-11 months', 'start of month')
       GROUP BY m ORDER BY m`,
    ).bind(org).all<MonthRow>(),
    env.DB.prepare(
      `SELECT strftime('%Y-%m', date) m, COALESCE(SUM(amount), 0) n FROM donations
       WHERE org_id = ? AND date >= date('now', '-11 months', 'start of month')
       GROUP BY m ORDER BY m`,
    ).bind(org).all<MonthRow>(),
    env.DB.prepare(
      `SELECT status label, COUNT(*) n FROM animals WHERE org_id = ? GROUP BY status ORDER BY n DESC`,
    ).bind(org).all<{ label: string; n: number }>(),
    env.DB.prepare(
      `SELECT COALESCE(species, 'unknown') label, COUNT(*) n FROM animals WHERE org_id = ? GROUP BY species ORDER BY n DESC LIMIT 10`,
    ).bind(org).all<{ label: string; n: number }>(),
    env.DB.prepare(
      `SELECT COALESCE(l.name, 'no location') label, COUNT(*) n FROM animals a
       LEFT JOIN locations l ON l.id = a.location_id
       WHERE a.org_id = ? AND a.status NOT IN ('adopted','deceased','transferred')
       GROUP BY l.name ORDER BY n DESC`,
    ).bind(org).all<{ label: string; n: number }>(),
    env.DB.prepare(
      `SELECT ROUND(AVG(julianday(ad.date) - julianday(a.intake_date)), 1) avg_days, COUNT(*) n
       FROM adoptions ad JOIN animals a ON a.id = ad.animal_id
       WHERE ad.org_id = ? AND a.intake_date IS NOT NULL AND ad.date IS NOT NULL
         AND julianday(ad.date) >= julianday(a.intake_date)`,
    ).bind(org).first<{ avg_days: number | null; n: number }>(),
    env.DB.prepare(
      `SELECT status label, COUNT(*) n FROM applications WHERE org_id = ? GROUP BY status`,
    ).bind(org).all<{ label: string; n: number }>(),
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM animals WHERE org_id = ?1) animals,
        (SELECT COUNT(*) FROM adoptions WHERE org_id = ?1) adoptions,
        (SELECT COALESCE(SUM(amount),0) FROM donations WHERE org_id = ?1) donated`,
    ).bind(org).first<{ animals: number; adoptions: number; donated: number }>(),
  ]);

  // fill the last 12 months so the charts have a steady x-axis
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const series = (rows: MonthRow[]) => {
    const map = new Map(rows.map((r) => [r.m, r.n]));
    return months.map((m) => ({ m, n: map.get(m) ?? 0 }));
  };

  return {
    months,
    intakes: series(intakes.results),
    adoptions: series(adoptions.results),
    donations: series(donations.results),
    byStatus: byStatus.results,
    bySpecies: bySpecies.results,
    byLocation: byLocation.results,
    stay: stay ?? { avg_days: null, n: 0 },
    funnel: Object.fromEntries(funnel.results.map((r) => [r.label, r.n])) as Record<string, number>,
    totals: totals ?? { animals: 0, adoptions: 0, donated: 0 },
  };
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function BarChart({
  title,
  data,
  money,
  color,
}: {
  title: string;
  data: { m: string; n: number }[];
  money?: boolean;
  color: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <section className="rounded-blob bg-white shadow-soft p-6">
      <h2 className="font-display font-semibold text-lg">{title}</h2>
      <div className="mt-4 flex items-end gap-1.5 h-36" role="img" aria-label={title}>
        {data.map((d) => (
          <div key={d.m} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.m}: ${money ? fmtMoney(d.n) : d.n}`}>
            <span className="text-[10px] font-semibold text-charcoal-soft">
              {d.n > 0 ? (money ? `$${Math.round(d.n / 100) / 10}k`.replace("$0k", fmtMoney(d.n)) : d.n) : ""}
            </span>
            <div
              className={`w-full rounded-t-lg ${color}`}
              style={{ height: `${Math.max(d.n > 0 ? 6 : 2, Math.round((d.n / max) * 100))}%` }}
            />
            <span className="text-[10px] text-charcoal-soft">{d.m.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BreakdownList({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="rounded-blob bg-white shadow-soft p-6">
      <h2 className="font-display font-semibold text-lg">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal-soft">Nothing here yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex justify-between font-semibold">
                <span>{r.label}</span>
                <span>{r.n.toLocaleString()}</span>
              </div>
              <div className="mt-0.5 h-2.5 rounded-full bg-cream overflow-hidden">
                <div className="h-full bg-sky" style={{ width: `${Math.round((r.n / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Reports({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const apps = (d.funnel.new ?? 0) + (d.funnel.approved ?? 0) + (d.funnel.denied ?? 0);
  const approvalRate = apps > 0 ? Math.round(((d.funnel.approved ?? 0) / apps) * 100) : null;
  const intakes12 = d.intakes.reduce((s, r) => s + r.n, 0);
  const adoptions12 = d.adoptions.reduce((s, r) => s + r.n, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-semibold">Reports</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          ["friends, all time", d.totals.animals.toLocaleString()],
          ["adoptions, all time", d.totals.adoptions.toLocaleString()],
          ["intakes (12 mo)", intakes12.toLocaleString()],
          ["adoptions (12 mo)", adoptions12.toLocaleString()],
          ["avg days to adoption", d.stay.avg_days != null ? String(d.stay.avg_days) : "—"],
          ["raised, all time", fmtMoney(d.totals.donated)],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-blob bg-white shadow-soft p-4 text-center">
            <div className="text-2xl font-display font-bold text-meadow-deep">{value}</div>
            <div className="text-xs font-semibold text-charcoal-soft">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <BarChart title="Intakes by month" data={d.intakes} color="bg-sky" />
        <BarChart title="Adoptions by month" data={d.adoptions} color="bg-meadow" />
      </div>
      <BarChart title="Donations by month" data={d.donations} money color="bg-sunflower" />

      <div className="grid lg:grid-cols-3 gap-6">
        <BreakdownList title="Friends by status" rows={d.byStatus} />
        <BreakdownList title="Friends by species" rows={d.bySpecies} />
        <BreakdownList title="In care by location" rows={d.byLocation} />
      </div>

      <section className="rounded-blob bg-white shadow-soft p-6">
        <h2 className="font-display font-semibold text-lg">Application funnel</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            ["received", apps],
            ["awaiting review", d.funnel.new ?? 0],
            ["approved", d.funnel.approved ?? 0],
            ["approval rate", approvalRate != null ? `${approvalRate}%` : "—"],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl bg-cream p-4">
              <div className="text-2xl font-display font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
              <div className="text-xs font-semibold text-charcoal-soft">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
