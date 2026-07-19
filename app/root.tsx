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
  { rel: "icon", type: "image/png", href: "/art/favicon.png" },
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
      <img
        src="/art/wander.webp"
        alt=""
        width={512}
        height={512}
        className="w-40 h-40 rounded-blob shadow-soft -rotate-3"
      />
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
