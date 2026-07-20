import { Form, Link, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { requireUser } from "../../lib/auth.server";
import { Logo } from "../../components/site";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  // one round trip: the badge count, plus (for demo sessions) the health
  // numbers the self-heal needs — a demo must never render empty
  const counts = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM applications WHERE org_id = ?1 AND status = 'new') new_apps` +
      (user.demo
        ? `, (SELECT COUNT(*) FROM animals WHERE org_id = ?1) demo_animals,
             (SELECT COUNT(*) FROM animal_photos WHERE org_id = ?1) demo_photos`
        : ``),
  )
    .bind(user.org_id)
    .first<{ new_apps: number; demo_animals?: number; demo_photos?: number }>();
  if (user.demo && !((counts?.demo_animals ?? 0) > 0 && (counts?.demo_photos ?? 0) > 1)) {
    try {
      const { resetDemoData } = await import("../../../workers/lib/demo");
      await resetDemoData(env, new URL(request.url).origin);
    } catch (err) {
      console.log(`[demo self-heal failed] ${err instanceof Error ? err.message : err}`);
    }
  }
  return { user, newApps: counts?.new_apps ?? 0 };
}

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/animals", label: "Animals" },
  { to: "/app/people", label: "People" },
  { to: "/app/applications", label: "Applications" },
  { to: "/app/fosters", label: "Fosters" },
  { to: "/app/volunteers", label: "Volunteers" },
  { to: "/app/donations", label: "Donations" },
  { to: "/app/grants", label: "Grants" },
  { to: "/app/network", label: "Network" },
  { to: "/app/website", label: "Website" },
  { to: "/app/brand", label: "Brand" },
  { to: "/app/marketing", label: "Marketing" },
  { to: "/app/radar", label: "Radar" },
  { to: "/app/reports", label: "Reports" },
  { to: "/app/settings", label: "Settings" },
  { to: "/app/help", label: "Help" },
];

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user, newApps } = loaderData;
  return (
    <div className="min-h-screen flex flex-col">
      {Boolean(user.demo) && (
        <div className="bg-sunflower text-charcoal text-center text-sm font-semibold py-1.5 px-4">
          🌻 You're exploring the demo shelter — click anything, change anything. It resets itself every six hours.
        </div>
      )}
      <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-sunflower-soft">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/app" className="flex items-center gap-2 font-display font-semibold text-lg truncate">
            <Logo className="w-8 h-8 shrink-0" />
            <span className="truncate">{user.org_name}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to={`/adopt/${user.slug}`}
              className="hidden sm:block text-sm font-semibold text-meadow-deep hover:underline"
            >
              Your adoption page ↗
            </Link>
            <Form method="post" action="/logout">
              <button className="text-sm font-semibold text-charcoal-soft hover:text-charcoal">
                Sign out
              </button>
            </Form>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 flex gap-1 overflow-x-auto pb-2 -mt-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              prefetch="intent"
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  isActive ? "bg-sunflower text-charcoal" : "text-charcoal-soft hover:bg-sunflower-soft"
                }`
              }
            >
              {item.label}
              {item.label === "Applications" && newApps > 0 && (
                <span className="ml-1.5 rounded-full bg-terracotta text-white text-xs px-1.5 py-0.5">
                  {newApps}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-sunflower-soft py-4 text-center text-sm text-charcoal-soft">
        Peace and all good things to you and your animals.
      </footer>
    </div>
  );
}
