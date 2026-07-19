import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("import", "routes/import.tsx"),
  route("import/:jobId", "routes/import.job.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("demo", "routes/demo.tsx"),
  route("unsub/:token", "routes/unsub.tsx"),
  route("logout", "routes/logout.tsx"),

  // public adoption portal + QR quick lookup
  route("adopt/:slug", "routes/adopt.tsx"),
  route("adopt/:slug/match", "routes/adopt.match.tsx"),
  route("adopt/:slug/:animalId", "routes/adopt.animal.tsx"),
  route("adopt/:slug/:animalId/flyer", "routes/adopt.flyer.tsx"),
  route("adopt/:slug/:animalId/embed", "routes/adopt.embed.tsx"),
  route("a/:animalId", "routes/quick.tsx"),

  // shelter websites (block CMS)
  route("s/:slug/:pageSlug?", "routes/site.page.tsx"),

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
    route("reports", "routes/app/reports.tsx"),
    route("brand", "routes/app/brand.tsx"),
    route("brand/guidelines", "routes/app/brand.guidelines.tsx"),
    route("marketing", "routes/app/marketing.tsx"),
    route("marketing/calendar", "routes/app/marketing.calendar.tsx"),
    route("marketing/:campaignId", "routes/app/marketing.campaign.tsx"),
    route("website", "routes/app/website.tsx"),
    route("website/pages/:pageId", "routes/app/website.page.tsx"),
    route("website/media", "routes/app/website.media.tsx"),
    route("website/interview", "routes/app/website.interview.tsx"),
    route("website/domain", "routes/app/website.domain.tsx"),
    route("website/seo", "routes/app/website.seo.tsx"),
    route("settings", "routes/app/settings.tsx"),
  ]),
] satisfies RouteConfig;
