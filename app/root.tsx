import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "Something unexpected happened. It's not you, it's us.";
  let stack: string | undefined;
  let is404 = false;

  if (isRouteErrorResponse(error)) {
    is404 = error.status === 404;
    message = is404 ? "404" : "Error";
    details = is404
      ? "This little one seems to have wandered off. Let's get you back home."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <svg
        viewBox="0 0 120 120"
        className="w-28 h-28 text-terracotta"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {/* wandering pup, line-art */}
        <path d="M25 80 Q30 60 50 62 Q75 64 82 52 Q88 42 96 46" />
        <circle cx="98" cy="44" r="7" />
        <path d="M97 38 l3 -6 l4 5" />
        <path d="M35 80 v14 M48 80 v14 M65 78 v16 M78 74 v20" />
        <path d="M25 80 q-8 -2 -6 -12" />
      </svg>
      <h1 className="text-6xl font-display font-semibold text-charcoal">{message}</h1>
      <p className="max-w-md text-lg text-charcoal-soft">{details}</p>
      <Link
        to="/"
        className="rounded-full bg-sunflower px-6 py-3 font-display font-semibold text-charcoal shadow-soft hover:shadow-lift transition-shadow"
      >
        Take me home
      </Link>
      {stack && (
        <pre className="w-full max-w-3xl p-4 overflow-x-auto text-left text-xs bg-white rounded-2xl">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
