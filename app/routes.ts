import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("import", "routes/import.tsx"),
  route("import/:jobId", "routes/import.job.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),

  // public adoption portal + QR quick lookup
  route("adopt/:slug", "routes/adopt.tsx"),
  route("adopt/:slug/:animalId", "routes/adopt.animal.tsx"),
  route("a/:animalId", "routes/quick.tsx"),

  // staff app
  route("app", "routes/app/layout.tsx", [
    index("routes/app/dashboard.tsx"),
    route("animals", "routes/app/animals.tsx"),
    route("animals/new", "routes/app/animal.new.tsx"),
    route("animals/:animalId", "routes/app/animal.detail.tsx"),
    route("animals/:animalId/card", "routes/app/animal.card.tsx"),
    route("people", "routes/app/people.tsx"),
    route("applications", "routes/app/applications.tsx"),
    route("fosters", "routes/app/fosters.tsx"),
    route("donations", "routes/app/donations.tsx"),
    route("settings", "routes/app/settings.tsx"),
  ]),
] satisfies RouteConfig;
