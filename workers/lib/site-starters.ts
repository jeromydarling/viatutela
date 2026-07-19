/**
 * Starter website pages — created as DRAFTS for new orgs (at signup)
 * and on demand from the Website hub. Idempotent per slug.
 */

import { newId } from "./ids";

export const STARTERS: { slug: string; title: string; sections: (orgName: string, orgSlug: string) => unknown[] }[] = [
  {
    slug: "home",
    title: "Home",
    sections: (orgName, orgSlug) => [
      { type: "home_hero", eyebrow: "Welcome to", heading: orgName, sub: "Every animal deserves a way home — come meet yours.", cta_label: "Meet the animals", cta_href: `/adopt/${orgSlug}` },
      { type: "adoptable_grid", heading: "Looking for a home", limit: 6 },
      { type: "cta_band", heading: "Lend a paw", text: "Adopt, foster, volunteer, or give — every bit of kindness counts.", primary_label: "Adopt", primary_href: `/adopt/${orgSlug}`, secondary_label: "Donate", secondary_href: `/s/${orgSlug}/donate` },
      { type: "newsletter_signup", heading: "Stay close to the pack", text: "Occasional good news, adoption days, and friends who found home." },
    ],
  },
  {
    slug: "about",
    title: "About us",
    sections: (orgName) => [
      { type: "prose", md: `## Our story\n\nWrite the story of ${orgName} here — how you began, who you serve, and what you believe about animals and the people who love them.` },
      { type: "quote", text: "Saving one animal won't change the world, but for that one animal the world changes forever.", attribution: "" },
    ],
  },
  {
    slug: "adopt",
    title: "Adopt",
    sections: (_orgName, orgSlug) => [
      { type: "hero", heading: "Adopt a friend", sub: "Applying is free and starts a conversation — it never commits you." },
      { type: "adoptable_grid", heading: "Waiting for you", limit: 12 },
      { type: "faq", heading: "How adopting works", items: [
        { q: "What does adoption cost?", a: "Fees vary by animal and cover vaccines, spay/neuter, and microchip." },
        { q: "How long does it take?", a: "Usually a few days: application, a quick conversation, then homecoming." },
      ] },
    ],
  },
  {
    slug: "donate",
    title: "Donate",
    sections: (orgName) => [
      { type: "hero", heading: "Give a little sunshine", sub: `Every cent goes to the animals in ${orgName}'s care.` },
      { type: "prose", md: "Tell supporters how gifts are used — food, vet care, warm beds — and how to give (check, cash, online)." },
      { type: "cta_band", heading: "Ready to help?", text: "Reach out and we'll make it easy.", primary_label: "Contact us", primary_href: "mailto:" },
    ],
  },
  {
    slug: "volunteer",
    title: "Volunteer & foster",
    sections: () => [
      { type: "hero", heading: "Join the flock", sub: "Walk dogs, cuddle cats, foster a friend between homes." },
      { type: "prose", md: "Describe your volunteer roles and foster program here — time commitment, training, and who to contact." },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    sections: () => [
      { type: "faq", heading: "Good questions", items: [
        { q: "Where are you located?", a: "Add your address and visiting hours here." },
        { q: "Can I visit before applying?", a: "Tell people how visits work." },
      ] },
    ],
  },
];

export async function createStarterPages(env: Env, orgId: string, orgName: string, slug: string): Promise<number> {
  let created = 0;
  for (const st of STARTERS) {
    const exists = await env.DB.prepare(`SELECT id FROM pages WHERE org_id = ? AND slug = ?`).bind(orgId, st.slug).first();
    if (exists) continue;
    await env.DB.prepare(
      `INSERT INTO pages (id, org_id, slug, title, sections) VALUES (?, ?, ?, ?, ?)`,
    ).bind(newId("pg"), orgId, st.slug, st.title, JSON.stringify(st.sections(orgName, slug))).run();
    created++;
  }
  const nav = [
    { label: "Home", href: `/s/${slug}` },
    { label: "Adopt", href: `/s/${slug}/adopt` },
    { label: "About", href: `/s/${slug}/about` },
    { label: "Donate", href: `/s/${slug}/donate` },
    { label: "Volunteer", href: `/s/${slug}/volunteer` },
    { label: "FAQ", href: `/s/${slug}/faq` },
  ];
  await env.DB.prepare(`UPDATE orgs SET nav_json = COALESCE(nav_json, ?) WHERE id = ?`)
    .bind(JSON.stringify(nav), orgId).run();
  return created;
}
