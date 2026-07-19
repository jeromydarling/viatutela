import { createRequestHandler, RouterContextProvider } from "react-router";
import { api } from "./api";
import { cloudflareContext } from "../app/cloudflare-context";
import { resolveTenant, routeTenantPath, tenantRobots, tenantSitemap } from "./lib/tenant";
import { reportError } from "./lib/monitor";
import { GUIDES } from "../app/lib/guides";
import { STATES } from "../app/lib/guide-states";

export { ImportProgress } from "./import/processor";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleFetch(request, env, ctx);
    } catch (err) {
      ctx.waitUntil(reportError(env, err, `fetch ${new URL(request.url).pathname}`));
      throw err;
    }
  },

  async scheduled(event, env, ctx) {
    try {
      await handleScheduled(event, env, ctx);
    } catch (err) {
      ctx.waitUntil(reportError(env, err, `cron ${event.cron}`));
      throw err;
    }
  },
} satisfies ExportedHandler<Env>;

const handleFetch: ExportedHandlerFetchHandler<Env> = async (request, env, ctx) => {
    const url = new URL(request.url);

    // custom shelter domains: resolve tenant by Host, serve the public site
    const tenant = await resolveTenant(env, url.hostname);
    if (!tenant) {
      const marketing = marketingSeoFile(url);
      if (marketing) return marketing;
    }
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
};

/** robots.txt / sitemap.xml / llms.txt for the marketing site itself
 * (shelter tenant domains get their own via routeTenantPath). */
function marketingSeoFile(url: URL): Response | null {
  const MARKETING_PATHS = [
    "/", "/import", "/signup", "/login", "/privacy", "/terms", "/guides",
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    "/guides/start-a-rescue",
    ...STATES.map((s) => `/guides/start-a-rescue/${s.slug}`),
  ];
  if (url.pathname === "/robots.txt") {
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api\n\nSitemap: ${url.origin}/sitemap.xml\n`,
      { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" } },
    );
  }
  if (url.pathname === "/sitemap.xml") {
    const urls = MARKETING_PATHS.map(
      (p) => `  <url><loc>${url.origin}${p === "/" ? "" : p}</loc></url>`,
    ).join("\n");
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } },
    );
  }
  if (url.pathname === "/llms.txt") {
    return new Response(
      `# Tutela

> The all-in-one platform for animal shelters, rescues, and fosters: animal management, adoption pages and applications, foster tracking, donor CRM, a website builder with custom domains, marketing tools, and AI assistance (matchmaking, application triage, bio writing, photo enhancement, grant drafting). Warm by design — animals are "friends" here.

Pricing: Starter is $9/month plus $1 per adoption. Rescue is $39/month flat. Shelter Pro is $79/month flat. The migration importer is free and needs no account.

## Pages

- [Home](${url.origin}/): product overview, features, impact stats, pricing, comparisons
- [Free importer](${url.origin}/import): migrate from any shelter software — relationships preserved
- [Get started](${url.origin}/signup): create a shelter workspace
- [Live demo](${url.origin}/demo): a fully seeded demo shelter, no signup
- [Privacy](${url.origin}/privacy) and [Terms](${url.origin}/terms): plain-language policies — shelters own their data

## Guides

${GUIDES.map((g) => `- [${g.title}](${url.origin}/guides/${g.slug}): ${g.description}`).join("\n")}
- [Start a rescue in your state](${url.origin}/guides/start-a-rescue): founder's guides for all 50 US states — incorporation, licensing, regional rescue realities

Each shelter also gets public adoption pages at /adopt/<shelter> and an optional website at /s/<shelter> or their own domain.
`,
      { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } },
    );
  }
  return null;
}

const handleScheduled: ExportedHandlerScheduledHandler<Env> = async (event, env, ctx) => {
    if (event.cron === "15 */6 * * *") {
      // keep the demo shelter fresh — visitors can change anything
      const { resetDemoData } = await import("./lib/demo");
      ctx.waitUntil(resetDemoData(env, env.APP_ORIGIN));
      return;
    }
    if (event.cron === "30 14 * * *") {
      // daily: post-adoption check-ins, gotcha days, onboarding drip, housekeeping
      const { processFollowups } = await import("./lib/lifecycle");
      ctx.waitUntil(processFollowups(env, env.APP_ORIGIN));
      const { processOnboardingEmails } = await import("./lib/onboarding");
      ctx.waitUntil(processOnboardingEmails(env, env.APP_ORIGIN));
      ctx.waitUntil(
        env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run().then(() => {}),
      );
      return;
    }
    const { sendMedicalDigests } = await import("./lib/digest");
    ctx.waitUntil(sendMedicalDigests(env, env.APP_ORIGIN));
    const { autoLongStaySpotlights } = await import("./lib/marketing-auto");
    ctx.waitUntil(autoLongStaySpotlights(env));
};
