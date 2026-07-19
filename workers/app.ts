import { createRequestHandler, RouterContextProvider } from "react-router";
import { api } from "./api";
import { cloudflareContext } from "../app/cloudflare-context";
import { resolveTenant, routeTenantPath, tenantRobots, tenantSitemap } from "./lib/tenant";

export { ImportProgress } from "./import/processor";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // custom shelter domains: resolve tenant by Host, serve the public site
    const tenant = await resolveTenant(env, url.hostname);
    if (tenant) {
      const route = routeTenantPath(url.pathname, tenant.slug);
      if (route.kind === "sitemap") return tenantSitemap(env, tenant, url.origin);
      if (route.kind === "robots") return tenantRobots(url.origin);
      if (route.kind === "blocked") {
        return new Response("This little one seems to have wandered off.", { status: 404 });
      }
      if (route.kind === "rewrite") {
        const rewritten = new URL(url);
        rewritten.pathname = route.path;
        request = new Request(rewritten, request) as typeof request;
      }
      // passthrough falls straight into the normal pipeline below
    }

    const rewrittenUrl = new URL(request.url);
    if (rewrittenUrl.pathname === "/api" || rewrittenUrl.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },

  async scheduled(event, env, ctx) {
    if (event.cron === "15 */6 * * *") {
      // keep the demo shelter fresh — visitors can change anything
      const { resetDemoData } = await import("./lib/demo");
      ctx.waitUntil(resetDemoData(env, env.APP_ORIGIN));
      return;
    }
    if (event.cron === "30 14 * * *") {
      // daily: post-adoption check-ins, gotcha days, onboarding drip
      const { processFollowups } = await import("./lib/lifecycle");
      ctx.waitUntil(processFollowups(env, env.APP_ORIGIN));
      const { processOnboardingEmails } = await import("./lib/onboarding");
      ctx.waitUntil(processOnboardingEmails(env, env.APP_ORIGIN));
      return;
    }
    const { sendMedicalDigests } = await import("./lib/digest");
    ctx.waitUntil(sendMedicalDigests(env, env.APP_ORIGIN));
    const { autoLongStaySpotlights } = await import("./lib/marketing-auto");
    ctx.waitUntil(autoLongStaySpotlights(env));
  },
} satisfies ExportedHandler<Env>;
