import { createRequestHandler, RouterContextProvider } from "react-router";
import { api } from "./api";
import { cloudflareContext } from "../app/cloudflare-context";

export { ImportProgress } from "./import/processor";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
