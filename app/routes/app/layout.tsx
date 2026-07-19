import { Form, Link, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { requireUser } from "../../lib/auth.server";
import { BirdDoodle } from "../../components/doodles";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env, user } = await requireUser(context, request);
  const newApps = await env.DB.prepare(
    `SELECT COUNT(*) n FROM applications WHERE org_id = ? AND status = 'new'`,
  )
    .bind(user.org_id)
    .first<{ n: number }>();
  return { user, newApps: newApps?.n ?? 0 };
}

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/animals", label: "Animals" },
  { to: "/app/people", label: "People" },
  { to: "/app/applications", label: "Applications" },
  { to: "/app/fosters", label: "Fosters" },
  { to: "/app/donations", label: "Donations" },
  { to: "/app/settings", label: "Settings" },
];

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user, newApps } = loaderData;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-sunflower-soft">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/app" className="flex items-center gap-2 font-display font-semibold text-lg truncate">
            <BirdDoodle className="w-8 h-8 shrink-0 text-meadow-deep" />
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
