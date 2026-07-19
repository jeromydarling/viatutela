import type { Route } from "./+types/site.page";
import { getEnv } from "../lib/auth.server";
import { handleNewsletterSignup, loadSitePage } from "../lib/site.server";
import { RenderSections } from "../components/site-sections";
import { Markdown } from "../components/markdown";
import { BrandStyle, PreviewBanner, ShelterSiteFooter, ShelterSiteHeader } from "../components/site-chrome";

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [];
  const title = data.page.meta_title || `${data.page.title} — ${data.org.name}`;
  const description = data.page.meta_description || data.page.subtitle || `${data.org.name} on Via Tutela`;
  const out: Record<string, string>[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];
  const ogImage = data.page.hero_image_url || data.seo.og_image;
  if (ogImage) out.push({ property: "og:image", content: ogImage });
  if (data.seo.google_verify) out.push({ name: "google-site-verification", content: data.seo.google_verify });
  if (data.seo.bing_verify) out.push({ name: "msvalidate.01", content: data.seo.bing_verify });
  if (data.isPreview || !data.seo.visible) out.push({ name: "robots", content: "noindex" });
  return out;
}

/** schema.org AnimalShelter — local SEO's backbone. Rendered on the homepage. */
function shelterJsonLd(org: { name: string; email: string | null; phone: string | null; address: string | null; website: string | null }): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AnimalShelter",
    name: org.name,
  };
  if (org.email) data.email = org.email;
  if (org.phone) data.telephone = org.phone;
  if (org.address) data.address = org.address;
  if (org.website) data.url = org.website;
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const pageSlug = params.pageSlug ?? "home";
  return loadSitePage(env, params.slug, pageSlug, url.searchParams.get("preview"));
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const env = getEnv(context);
  const f = await request.formData();
  if (f.get("intent") === "newsletter") {
    return { newsletter: await handleNewsletterSignup(env, params.slug, String(f.get("email") ?? "")) };
  }
  return null;
}

export default function ShelterSitePage({ loaderData, actionData }: Route.ComponentProps) {
  const { org, page, sections, liveAnimals, isPreview, nav, brand } = loaderData;
  return (
    <div className="brand-scope min-h-screen">
      <BrandStyle brand={brand} />
      {page.slug === "home" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: shelterJsonLd(org) }} />
      )}
      {isPreview && <PreviewBanner />}
      <ShelterSiteHeader orgName={org.name} homeHref={`/s/${org.slug}`} nav={nav} brand={brand} />
      <main>
        {page.slug !== "home" && page.layout !== "hero" && sections.every((sec) => sec.type !== "hero" && sec.type !== "home_hero") && (
          <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-12 text-center">
            <h1 className="text-3xl sm:text-4xl font-display font-semibold">{page.title}</h1>
            {page.subtitle && <p className="mt-3 text-lg text-charcoal-soft">{page.subtitle}</p>}
          </div>
        )}
        <RenderSections
          sections={sections}
          ctx={{
            orgSlug: org.slug,
            accent: brand.accent,
            liveAnimals,
            newsletterState: actionData?.newsletter,
          }}
        />
        {page.body_md && (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            <Markdown text={page.body_md} className="text-lg" />
          </div>
        )}
      </main>
      <ShelterSiteFooter orgName={org.name} brand={brand} email={org.email} phone={org.phone} address={org.address} />
    </div>
  );
}
