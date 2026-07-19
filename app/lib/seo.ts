/**
 * Marketing-site SEO: one helper so every page gets a unique title,
 * description, canonical, and social preview card. Public shelter pages
 * (adopt/*, s/*) manage their own richer metadata.
 */

// The launch domain. Canonicals, OG URLs, and JSON-LD all point here —
// attach viatutela.com to the Worker (Custom Domains) so they resolve.
export const SITE_ORIGIN = "https://viatutela.com";

export const SITE_NAME = "Tutela";
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/art/meadow.webp`;

export function marketingMeta(args: {
  title: string;
  description: string;
  path: string; // "/", "/import", …
  image?: string;
}): Record<string, string>[] {
  const url = `${SITE_ORIGIN}${args.path === "/" ? "" : args.path}`;
  const image = args.image ?? DEFAULT_OG_IMAGE;
  return [
    { title: args.title },
    { name: "description", content: args.description },
    { tagName: "link", rel: "canonical", href: url || SITE_ORIGIN },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:title", content: args.title },
    { property: "og:description", content: args.description },
    { property: "og:url", content: url || SITE_ORIGIN },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: args.title },
    { name: "twitter:description", content: args.description },
    { name: "twitter:image", content: image },
  ];
}
