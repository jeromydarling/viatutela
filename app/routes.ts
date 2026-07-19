import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("import", "routes/import.tsx"),
  route("import/:jobId", "routes/import.job.tsx"),
  route("app", "routes/app.tsx"),
] satisfies RouteConfig;
