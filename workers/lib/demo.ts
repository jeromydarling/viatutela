/**
 * The live demo shelter — "Sunny Meadow Rescue".
 *
 * A real org (demo=1) seeded with rich, warm, fake content so visitors
 * can take the whole app for a spin: animals with photos and bonded
 * pairs, a year of adoptions and donations for the charts, applications
 * with a pre-canned AI review, a published website, brand tokens, and
 * marketing campaigns mid-flight.
 *
 * Fully interactive on purpose — a cron re-runs resetDemoData every six
 * hours, so visitors can poke anything. IDs are fixed (dm_*) and dates
 * are relative (date('now','-N days')) so the demo never goes stale.
 */

import { hashPassword } from "./password";
import { newToken } from "./ids";

export const DEMO_SLUG = "sunny-meadow-demo";
export const DEMO_EMAIL = "demo@viatutela.app";

export const DEMO_PASSWORD = "sunflower";
const ORG = "org_demo_sunnymeadow";
const USER = "u_demo_sunnymeadow";

const BRAND = {
  palette: { primary: "#2e7d54", accent: "#e8a13c", ink: "#2e2a26", bg: "#fff9f0" },
  logo: { kind: "wordmark", imageUrl: null },
  wordmark: { font: "quicksand", case: "title", tracking: 30, weight: 600 },
  typography: "friendly",
  theme: "storybook",
  tagline: "Every friend deserves a sunny landing.",
  voice:
    "Sunny, plain-spoken, and a little playful. We celebrate small victories loudly, never guilt-trip, and always talk about animals as friends with personalities — not case numbers.",
  accent: "#e8a13c",
};

const NAV = [
  { label: "Home", href: `/s/${DEMO_SLUG}` },
  { label: "About", href: `/s/${DEMO_SLUG}/about` },
  { label: "Adopt", href: `/adopt/${DEMO_SLUG}` },
  { label: "Donate", href: `/s/${DEMO_SLUG}/donate` },
];

/** Create the org + login if missing. Safe to call every time. */
export async function ensureDemoOrg(env: Env): Promise<void> {
  const existing = await env.DB.prepare(`SELECT id FROM orgs WHERE id = ?`).bind(ORG).first();
  if (existing) return;
  const { hash, salt } = await hashPassword(DEMO_PASSWORD);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orgs (id, slug, name, plan, demo, about, email, phone, address, nav_json, brand_json, seo_json)
       VALUES (?, ?, 'Sunny Meadow Rescue', 'pro', 1, ?, 'hello@sunnymeadow.example', '(555) 010-7387', '412 Meadowlark Lane, Larkspur, CO', ?, ?, ?)`,
    ).bind(
      ORG,
      DEMO_SLUG,
      "A small foster-based rescue in the foothills — seniors and bonded pairs are our specialty.",
      JSON.stringify(NAV),
      JSON.stringify(BRAND),
      JSON.stringify({ visible: true, google_verify: "", bing_verify: "", og_image: "" }),
    ),
    env.DB.prepare(
      `INSERT INTO users (id, org_id, email, name, password_hash, password_salt) VALUES (?, ?, ?, 'Demo Explorer', ?, ?)`,
    ).bind(USER, ORG, DEMO_EMAIL, hash, salt),
  ]);
}

/** Sign the visitor in as the demo user. Returns the session token. */
export async function createDemoSession(env: Env): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(token, USER, expires)
    .run();
  return token;
}

export async function isDemoSeeded(env: Env): Promise<boolean> {
  // "seeded" means alive: animals AND their photos. A photoless demo (a
  // reseed whose art fetches failed) should heal on the next visit.
  const row = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM animals WHERE org_id = ?1) a,
            (SELECT COUNT(*) FROM animal_photos WHERE org_id = ?1) p`,
  )
    .bind(ORG)
    .first<{ a: number; p: number }>();
  return Boolean(row && row.a > 0 && row.p > 1);
}

// ---------------------------------------------------------------------------
// Seed content
// ---------------------------------------------------------------------------

interface SeedAnimal {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  dobDays: number; // age in days
  altered: number;
  status: string;
  kennel?: string;
  color?: string;
  weight?: string;
  chip?: string;
  bonded?: string;
  intakeDays: number; // days since intake
  description: string | null;
  art?: string; // /art/*.webp to use as photo
}

const ANIMALS: SeedAnimal[] = [
  {
    id: "dm_an_biscuit", name: "Biscuit", species: "dog", breed: "terrier mix", sex: "male", dobDays: 1500,
    altered: 1, status: "available", kennel: "K-7", color: "wheat", weight: "24 lb", chip: "985112004561234",
    bonded: "dm_bond_bw", intakeDays: 41, art: "demo-biscuit",
    description:
      "Biscuit believes every squeaky toy has a soul and he is their shepherd. Four years of pure wag, sits for treats, walks like a gentleman, and falls asleep mid-play with his legs in the air. He and Waffle have been best friends since the day they were found sharing one blanket — they go home together.",
  },
  {
    id: "dm_an_waffle", name: "Waffle", species: "dog", breed: "beagle", sex: "female", dobDays: 1800,
    altered: 1, status: "available", kennel: "K-7", color: "tricolor", weight: "19 lb", chip: "985112004569876",
    bonded: "dm_bond_bw", intakeDays: 41, art: "demo-waffle",
    description:
      "Waffle is the brains of the Biscuit-and-Waffle operation: she opens the treat drawer, he celebrates. A gentle beagle who hums when she's happy and insists on morning sniff-safaris. Bonded with Biscuit — one home, two shadows.",
  },
  {
    id: "dm_an_mochi", name: "Mochi", species: "cat", breed: "domestic shorthair", sex: "female", dobDays: 1100,
    altered: 1, status: "available", kennel: "C-2", color: "cream tabby", weight: "9 lb", chip: "985112004512378",
    intakeDays: 27, art: "demo-mochi",
    description:
      "Mochi naps professionally and judges gently. She'll pretend indifference for exactly one afternoon, then claim your laptop keyboard, your favorite chair, and your whole heart. Great with calm homes; prefers to be your one and only.",
  },
  {
    id: "dm_an_clover", name: "Clover", species: "rabbit", breed: "holland lop", sex: "female", dobDays: 700,
    altered: 1, status: "available", kennel: "SB-1", color: "gray", weight: "3.5 lb",
    intakeDays: 63, art: "demo-clover",
    description:
      "Clover does a little hop-spin (a 'binky', ask any rabbit person) when the greens come out. Litter-trained, curious, and surprisingly opinionated about cardboard castles. Needs indoor housing and a human who understands that rabbits are roommates, not decor.",
  },
  {
    id: "dm_an_pearl", name: "Pearl", species: "cat", breed: "domestic longhair", sex: "female", dobDays: 4000,
    altered: 1, status: "available", kennel: "C-5", color: "white", weight: "8 lb", chip: "985112004598765",
    intakeDays: 128, art: "demo-pearl",
    description:
      "Pearl is eleven, silk-soft, and completely over drama. She wants a sunbeam, a lap on her own schedule, and someone who knows senior cats are the best-kept secret in rescue. Her adoption fee is sponsored — a kind neighbor already paid it forward.",
  },
  {
    id: "dm_an_ranger", name: "Ranger", species: "dog", breed: "shepherd mix", sex: "male", dobDays: 900,
    altered: 1, status: "in foster", color: "black & tan", weight: "52 lb", chip: "985112004523456",
    intakeDays: 88, art: "demo-ranger",
    description:
      "Ranger came in nervous and is blossoming in foster care — his foster reports he's now 'couch royalty with a PhD in fetch.' Smart, loyal, eager to learn; he'd love an active home that keeps his brain busy.",
  },
  {
    id: "dm_an_storm", name: "Storm", species: "cat", breed: "russian blue mix", sex: "male", dobDays: 1600,
    altered: 1, status: "in foster", color: "blue", weight: "11 lb",
    intakeDays: 74, art: "demo-storm",
    description:
      "Storm spent his first week hiding behind a bookshelf and now sleeps on his foster's pillow — his glow-up is documented in foster notes. Quiet homes only; rewards patience with headbutts.",
  },
  {
    id: "dm_an_peanut", name: "Peanut", species: "guinea pig", breed: null, sex: "male", dobDays: 400,
    altered: 0, status: "available", kennel: "SB-3", color: "caramel",
    intakeDays: 19, art: "demo-peanut",
    description:
      "Peanut squeaks the moment the fridge opens — hope springs eternal. A chatty, gentle little guy who'd love a roomy enclosure and maybe a guinea pig friend to gossip with.",
  },
  {
    id: "dm_an_juniper", name: "Juniper", species: "dog", breed: "husky mix", sex: "female", dobDays: 1200,
    altered: 1, status: "pending", kennel: "K-3", color: "silver", weight: "44 lb", chip: "985112004534567",
    intakeDays: 52, art: "demo-juniper",
    description:
      "Juniper talks — full husky monologues about her day, delivered with dramatic eye contact. Adoption pending with a lovely trail-running family (paws crossed!).",
  },
  {
    id: "dm_an_maple", name: "Maple", species: "cat", breed: "torbie", sex: "female", dobDays: 2600,
    altered: 1, status: "available", kennel: "C-8", color: "torbie",
    intakeDays: 203, art: "demo-maple",
    description: "Sweet girl, needs a quiet home.",
  },
  {
    id: "dm_an_ziggy", name: "Ziggy", species: "dog", breed: "lab mix puppy", sex: "male", dobDays: 160,
    altered: 0, status: "available", kennel: "K-1", color: "yellow", weight: "18 lb",
    intakeDays: 12, art: "demo-ziggy",
    description:
      "Ziggy is five months of pure applause. Everything is the best thing that has ever happened: breakfast! a leaf! you! Starting puppy classes next week; his adopter gets a graduate.",
  },
  {
    id: "dm_an_hazel", name: "Hazel", species: "cat", breed: "calico", sex: "female", dobDays: 2000,
    altered: 1, status: "adopted", color: "calico", intakeDays: 160, art: "demo-hazel",
    description: "Adopted last week — her new family sends photos daily and we are not tired of them.",
  },
];

/** Extra adopted-out animals to give the charts a year of history. */
const HISTORY_NAMES = [
  "Scout", "Poppy", "Otis", "Luna", "Beans", "Duke", "Willow", "Taco", "Ivy", "Bruno",
  "Sage", "Pickles", "Nova", "Chester", "Daisy", "Milo", "Olive", "Rocket", "Pepper", "Finn",
];

const CONTACTS: [string, string, string | null, string][] = [
  // id-suffix is index; [name, roles, phone, email]
  ["Clare Fontaine", "foster,volunteer", "(555) 010-2211", "clare@example.com"],
  ["Anthony Webb", "foster", "(555) 010-3322", "anthony@example.com"],
  ["Rufino Salas", "foster,adopter", "(555) 010-4433", "rufino@example.com"],
  ["Frances Bell", "newsletter", "(555) 010-5544", "frances@example.com"],
  ["Maya Ramirez", "volunteer,donor,newsletter", "(555) 010-6655", "maya@example.com"],
  ["The Okafor Family", "adopter", "(555) 010-7766", "okafors@example.com"],
  ["Kind Neighbor", "donor,newsletter", null, "kindneighbor@example.com"],
  ["Jordan Pruitt", "adopter,newsletter", "(555) 010-8877", "jordan@example.com"],
  ["Sunny Meadow Vet Clinic", "partner", "(555) 010-9988", "clinic@example.com"],
  ["Tessa Nguyen", "newsletter", null, "tessa@example.com"],
  ["Big Sky Feed & Supply", "donor", "(555) 010-1100", "bigsky@example.com"],
  ["Priya Patel", "volunteer,newsletter", "(555) 010-2233", "priya@example.com"],
];

const PRECANNED_REVIEW = {
  fit_score: 86,
  summary:
    "A thoughtful application: work-from-home schedule, prior senior-cat experience, and realistic expectations about a shy cat's settling-in period. The only gap is rental paperwork — they mention an apartment but not landlord approval.",
  green_flags: [
    "Works from home — great for a shy cat's adjustment",
    "Had a senior cat for 14 years (references offered)",
    "Asked about Mochi's vet history unprompted",
  ],
  red_flags: ["Apartment mentioned but no landlord pet approval yet"],
  better_fits: [],
  draft_reply:
    "Hi Frances,\n\nThank you for such a thoughtful application — Mochi would be lucky. One small thing before we set up a meet: could you send over your landlord's pet approval (or your building's pet policy)? Once we have that, we'd love to schedule a quiet meet-and-greet this week.\n\nWarmly,\nThe team",
  generated_at: new Date().toISOString(),
};

const PRECANNED_INSIGHTS = {
  headline: "Adoptions are up 22% over spring — but two long-stay friends need a spotlight this month.",
  highlights: [
    "96 adoptions in the last 12 months with a median 19 days to home — strong for a foster-based rescue.",
    "Maple (203 days) and Pearl (128 days) account for most of your long-stay time; both have zero applications this month.",
    "Donations cluster around campaign pushes — your supporters respond when you ask with a specific goal.",
    "Newsletter list grew 30% since the website launched; that's free reach for every animal you feature.",
  ],
  long_stay: [
    { animal_id: "dm_an_maple", name: "Maple", advice: "Her bio is one line — have the AI writer expand it from her foster notes, add three photos, and feature her in Friday's newsletter." },
    { animal_id: "dm_an_pearl", name: "Pearl", advice: "Lead with the sponsored fee: 'adopt Pearl, the fee's already covered.' Seniors move when the ask is concrete." },
    { animal_id: "dm_an_storm", name: "Storm", advice: "His foster glow-up story (bookshelf to pillow) is ready-made social gold — post the before/after." },
  ],
  try_next: [
    "Run a 'Senior Sunbeams' weekend: waived fees for Pearl and Maple, one warm social post each day.",
    "Ask Big Sky Feed & Supply to display Biscuit & Waffle's flyer by the register — bonded pairs need extra eyes.",
    "Send the supporter email in your Summer Fair campaign — it's drafted and your list is warm.",
  ],
  generated_at: new Date().toISOString(),
};

function days(n: number): string {
  return `-${n} days`;
}

/** Wipe and re-seed everything owned by the demo org (org + login persist). */
export async function resetDemoData(env: Env, _origin: string): Promise<void> {
  await ensureDemoOrg(env);

  // ---- wipe (children first — every org-scoped table, or FK constraints
  // abort the whole reset; when a migration adds a table, add it here) ----
  const wipe = [
    "webhook_deliveries", "webhooks", "api_keys",
    "shift_signups", "shifts", "waitlist_subscriptions", "followups", "grant_drafts",
    "transfer_posts", "billing_usage", "onboarding_emails",
    "marketing_assets", "marketing_campaigns", "ai_audit", "ai_usage", "email_suppression",
    "media", "pages", "applications", "adoptions", "foster_assignments", "medical_records",
    "animal_photos", "tasks", "donations", "campaigns", "contacts", "animals", "locations",
  ].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE org_id = ?`).bind(ORG));
  // restore org-level settings too — otherwise a visitor's tracker IDs or
  // brand edits on the demo org would outlive every reset
  wipe.push(
    env.DB.prepare(
      `UPDATE orgs SET nav_json = ?, brand_json = ?, seo_json = ?, ics_token = NULL,
         stripe_account_id = NULL, stripe_charges_enabled = 0 WHERE id = ?`,
    ).bind(
      JSON.stringify(NAV),
      JSON.stringify(BRAND),
      JSON.stringify({ visible: true, google_verify: "", bing_verify: "", og_image: "" }),
      ORG,
    ),
  );
  await env.DB.batch(wipe);

  const stmts: D1PreparedStatement[] = [];

  // ---- locations ----
  stmts.push(
    env.DB.prepare(`INSERT INTO locations (id, org_id, name, address, active) VALUES ('dm_loc_main', ?, 'Main Shelter', '412 Meadowlark Lane', 1)`).bind(ORG),
    env.DB.prepare(`INSERT INTO locations (id, org_id, name, address, active) VALUES ('dm_loc_foster', ?, 'Foster Network', NULL, 1)`).bind(ORG),
  );

  // ---- animals ----
  for (const a of ANIMALS) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO animals (id, org_id, name, species, breed, sex, dob, altered, microchip, status, description,
           bonded_group_id, kennel, color, weight, intake_date, is_public, location_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, date('now', ?), ?, ?, ?, ?, ?, ?, ?, ?, date('now', ?), 1, ?, datetime('now', ?))`,
      ).bind(
        a.id, ORG, a.name, a.species, a.breed, a.sex, days(a.dobDays), a.altered, a.chip ?? null,
        a.status, a.description, a.bonded ?? null, a.kennel ?? null, a.color ?? null, a.weight ?? null,
        days(a.intakeDays), a.status === "in foster" ? "dm_loc_foster" : "dm_loc_main", days(a.intakeDays),
      ),
    );
  }

  // history: adopted friends spread across 12 months (intakes + adoptions charts)
  HISTORY_NAMES.forEach((name, i) => {
    const species = i % 3 === 0 ? "cat" : i % 3 === 1 ? "dog" : i % 5 === 2 ? "rabbit" : "dog";
    const intake = 40 + i * 17;
    const homed = Math.max(5, intake - (12 + ((i * 7) % 40)));
    const id = `dm_an_h${i}`;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO animals (id, org_id, name, species, sex, altered, status, is_public, intake_date, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 'adopted', 0, date('now', ?), datetime('now', ?))`,
      ).bind(id, ORG, name, species, i % 2 ? "female" : "male", days(intake), days(intake)),
      env.DB.prepare(
        `INSERT INTO adoptions (id, org_id, animal_id, date, fee, status) VALUES (?, ?, ?, date('now', ?), ?, 'completed')`,
      ).bind(`dm_ad_h${i}`, ORG, id, days(homed), 50 + ((i * 35) % 200)),
    );
  });

  // ---- contacts ----
  CONTACTS.forEach(([name, roles, phone, email], i) => {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO contacts (id, org_id, name, email, phone, roles, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`,
      ).bind(`dm_ct_${i}`, ORG, name, email, phone, roles, days(300 - i * 20)),
    );
  });

  // ---- volunteer shifts: a living schedule + a year of logged hours ----
  const SHIFTS: [string, string, string, string | null, string | null, number][] = [
    // [id, title, date-offset, start, end, slots]
    ["dm_sh_1", "Morning kennels & walks", "+1 days", "08:00", "10:00", 4],
    ["dm_sh_2", "Adoption event — Big Sky Feed lot", "+3 days", "10:00", "14:00", 6],
    ["dm_sh_3", "Kitten room deep clean", "+6 days", "17:00", "19:00", 3],
    ["dm_sh_p1", "Morning kennels & walks", "-7 days", "08:00", "10:00", 4],
    ["dm_sh_p2", "Vaccine clinic day", "-30 days", "09:00", "13:00", 5],
    ["dm_sh_p3", "Spring adoption fair", "-75 days", "10:00", "15:00", 6],
  ];
  for (const [id, title, offset, start, end, slots] of SHIFTS) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO shifts (id, org_id, title, date, start_time, end_time, slots) VALUES (?, ?, ?, date('now', ?), ?, ?, ?)`,
      ).bind(id, ORG, title, offset, start, end, slots),
    );
  }
  // signups: upcoming shifts partly filled, past shifts feed hours + leaderboard
  // contacts: 0 Clare, 4 Maya, 11 Priya (volunteer-role contacts)
  const SIGNUPS: [string, string, string, number, number][] = [
    // [id, shift_id, contact_id, hours, created-days-ago]
    ["dm_sg_1", "dm_sh_1", "dm_ct_0", 2, 1],
    ["dm_sg_2", "dm_sh_1", "dm_ct_4", 2, 0],
    ["dm_sg_3", "dm_sh_2", "dm_ct_11", 4, 2],
    ["dm_sg_4", "dm_sh_p1", "dm_ct_0", 2, 7],
    ["dm_sg_5", "dm_sh_p1", "dm_ct_4", 2, 7],
    ["dm_sg_6", "dm_sh_p2", "dm_ct_0", 4, 30],
    ["dm_sg_7", "dm_sh_p2", "dm_ct_11", 4, 30],
    ["dm_sg_8", "dm_sh_p3", "dm_ct_4", 5, 75],
    ["dm_sg_9", "dm_sh_p3", "dm_ct_0", 5, 75],
    ["dm_sg_10", "dm_sh_p3", "dm_ct_11", 5, 75],
  ];
  for (const [id, shiftId, contactId, hours, ago] of SIGNUPS) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO shift_signups (id, org_id, shift_id, contact_id, hours, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`,
      ).bind(id, ORG, shiftId, contactId, hours, days(ago)),
    );
  }

  // ---- medical ----
  const med: [string, number, string, string, string | null, number | null][] = [
    // [animal, daysAgo, type, description, vet, dueInDays(null=none)]
    ["dm_an_biscuit", 30, "vaccine", "DHPP booster", "Sunny Meadow Vet Clinic", 335],
    ["dm_an_biscuit", 30, "vaccine", "Rabies (1yr)", "Sunny Meadow Vet Clinic", 335],
    ["dm_an_waffle", 30, "vaccine", "DHPP booster", "Sunny Meadow Vet Clinic", 335],
    ["dm_an_waffle", 400, "vaccine", "Rabies (1yr)", "Sunny Meadow Vet Clinic", -35],
    ["dm_an_mochi", 20, "vaccine", "FVRCP", "Sunny Meadow Vet Clinic", 345],
    ["dm_an_mochi", 20, "exam", "Intake exam — healthy, slight tartar", "Dr. Okafor", null],
    ["dm_an_pearl", 60, "exam", "Senior panel — early kidney values, prescription diet started", "Dr. Okafor", 120],
    ["dm_an_pearl", 55, "treatment", "Dental cleaning, two extractions — recovered beautifully", "Sunny Meadow Vet Clinic", null],
    ["dm_an_ranger", 80, "surgery", "Neuter", "Sunny Meadow Vet Clinic", null],
    ["dm_an_ranger", 15, "vaccine", "Bordetella", "Sunny Meadow Vet Clinic", 350],
    ["dm_an_storm", 70, "exam", "Intake exam — underweight, now 11 lb and thriving", "Dr. Okafor", null],
    ["dm_an_clover", 50, "exam", "Rabbit wellness — teeth and nails perfect", "Exotics of Larkspur", 130],
    ["dm_an_ziggy", 10, "vaccine", "Puppy DHPP #2 of 3", "Sunny Meadow Vet Clinic", 11],
    ["dm_an_juniper", 45, "surgery", "Spay", "Sunny Meadow Vet Clinic", null],
    ["dm_an_maple", 190, "vaccine", "FVRCP", "Sunny Meadow Vet Clinic", -10],
  ];
  med.forEach(([animal, ago, type, desc, vet, due], i) => {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO medical_records (id, org_id, animal_id, date, type, description, vet, due_date)
         VALUES (?, ?, ?, date('now', ?), ?, ?, ?, ${due == null ? "NULL" : `date('now', '${due >= 0 ? "+" : ""}${due} days')`})`,
      ).bind(`dm_md_${i}`, ORG, animal, days(ago as number), type, desc, vet),
    );
  });

  // ---- fosters ----
  stmts.push(
    env.DB.prepare(
      `INSERT INTO foster_assignments (id, org_id, animal_id, contact_id, start_date, notes, active)
       VALUES ('dm_fa_ranger', ?, 'dm_an_ranger', 'dm_ct_0', date('now','-60 days'),
         'Week 1: nervous, hid behind the couch. Week 3: discovered fetch. Week 6: couch royalty — sleeps upside down, knows sit/stay/spin. Great with Clare''s calm senior dog; unsure about cats.', 1)`,
    ).bind(ORG),
    env.DB.prepare(
      `INSERT INTO foster_assignments (id, org_id, animal_id, contact_id, start_date, notes, active)
       VALUES ('dm_fa_storm', ?, 'dm_an_storm', 'dm_ct_1', date('now','-50 days'),
         'Started under the bookshelf, now sleeps on Anthony''s pillow. Eats well, uses the box perfectly, chirps at birds. Needs a quiet home without toddlers.', 1)`,
    ).bind(ORG),
    env.DB.prepare(
      `INSERT INTO foster_assignments (id, org_id, animal_id, contact_id, start_date, end_date, notes, active)
       VALUES ('dm_fa_hazel', ?, 'dm_an_hazel', 'dm_ct_2', date('now','-120 days'), date('now','-8 days'), 'Foster graduate — adopted!', 0)`,
    ).bind(ORG),
  );

  // ---- applications ----
  stmts.push(
    env.DB.prepare(
      `INSERT INTO applications (id, org_id, animal_id, name, email, phone, home_type, message, status, interest, ai_review_json, created_at)
       VALUES ('dm_ap_frances', ?, 'dm_an_mochi', 'Frances Bell', 'frances@example.com', '(555) 010-5544', 'Apartment',
         'I work from home and lost my 14-year-old cat Winnie this spring. I''m ready for a quieter companion and Mochi''s bio made me laugh out loud. I''d love to ask about her vet history too. My vet can provide references.',
         'new', 'meet', ?, datetime('now','-1 days'))`,
    ).bind(ORG, JSON.stringify(PRECANNED_REVIEW)),
    env.DB.prepare(
      `INSERT INTO applications (id, org_id, animal_id, name, email, phone, home_type, message, status, interest, created_at)
       VALUES ('dm_ap_devon', ?, 'dm_an_biscuit', 'Devon Price', 'devon@example.com', '(555) 010-3141', 'House with a yard',
         'Two kids (8 and 11) who have been campaigning for a dog for a year. Big fenced yard. We understand Biscuit comes with Waffle and honestly that sold us — two for the price of endless joy.',
         'new', 'adopt', datetime('now','-3 days'))`,
    ).bind(ORG),
    env.DB.prepare(
      `INSERT INTO applications (id, org_id, animal_id, name, email, home_type, message, status, interest, created_at)
       VALUES ('dm_ap_sam', ?, NULL, 'Sam Torres', 'sam@example.com', 'Farm / rural',
         'We have 40 acres and a heated barn. Open to any friend who needs space — do you ever get livestock-savvy dogs?', 'new', 'question', datetime('now','-5 days'))`,
    ).bind(ORG),
    env.DB.prepare(
      `INSERT INTO applications (id, org_id, animal_id, name, email, status, interest, decided_at, created_at)
       VALUES ('dm_ap_ok', ?, 'dm_an_hazel', 'The Okafor Family', 'okafors@example.com', 'approved', 'adopt', datetime('now','-8 days'), datetime('now','-12 days'))`,
    ).bind(ORG),
    env.DB.prepare(
      `INSERT INTO applications (id, org_id, animal_id, name, email, status, interest, decided_at, created_at)
       VALUES ('dm_ap_denied', ?, 'dm_an_juniper', 'Alex Kim', 'alex@example.com', 'denied', 'adopt', datetime('now','-15 days'), datetime('now','-18 days'))`,
    ).bind(ORG),
  );
  stmts.push(
    env.DB.prepare(`INSERT INTO adoptions (id, org_id, animal_id, contact_id, date, fee, status) VALUES ('dm_ad_hazel', ?, 'dm_an_hazel', 'dm_ct_5', date('now','-8 days'), 95, 'completed')`).bind(ORG),
  );

  // ---- donations + campaigns ----
  stmts.push(
    env.DB.prepare(`INSERT INTO campaigns (id, org_id, name, goal, description, active) VALUES ('dm_cp_roof', ?, 'New Kennel Roof', 5000, 'The spring hailstorm won round one. Round two is ours.', 1)`).bind(ORG),
    env.DB.prepare(`INSERT INTO campaigns (id, org_id, name, goal, description, active) VALUES ('dm_cp_med', ?, 'Community Medical Fund', 2500, 'Covers seniors like Pearl — dental days and diagnostics.', 1)`).bind(ORG),
  );
  const donors = ["Kind Neighbor", "Maya Ramirez", "Big Sky Feed & Supply", "Jordan Pruitt", "Anonymous", "Priya Patel"];
  for (let i = 0; i < 26; i++) {
    const amount = [15, 25, 40, 50, 75, 100, 250, 500][i % 8];
    const campaign = i % 3 === 0 ? "dm_cp_roof" : i % 7 === 0 ? "dm_cp_med" : null;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO donations (id, org_id, campaign_id, donor_name, email, amount, method, date)
         VALUES (?, ?, ?, ?, NULL, ?, ?, date('now', ?))`,
      ).bind(`dm_dn_${i}`, ORG, campaign, donors[i % donors.length], amount, i % 4 === 0 ? "check" : "online", days(4 + i * 13)),
    );
  }

  // ---- tasks ----
  stmts.push(
    env.DB.prepare(`INSERT INTO tasks (id, org_id, title, due_date, animal_id, done) VALUES ('dm_tk_1', ?, 'New photos + longer bio for Maple', date('now','+2 days'), 'dm_an_maple', 0)`).bind(ORG),
    env.DB.prepare(`INSERT INTO tasks (id, org_id, title, due_date, animal_id, done) VALUES ('dm_tk_2', ?, 'Ziggy — puppy vaccine #3', date('now','+11 days'), 'dm_an_ziggy', 0)`).bind(ORG),
    env.DB.prepare(`INSERT INTO tasks (id, org_id, title, due_date, done) VALUES ('dm_tk_3', ?, 'Thank-you calls for roof campaign donors', date('now','+5 days'), 0)`).bind(ORG),
  );

  // ---- website pages ----
  const pages: [string, string, string, string, unknown[]][] = [
    // [id, slug, title, meta_description, sections]
    [
      "dm_pg_home", "home", "Welcome home", "Sunny Meadow Rescue — a small foothills rescue for seniors, bonded pairs, and every friend in between.",
      [
        { type: "home_hero", eyebrow: "Larkspur, Colorado", heading: "Small rescue. Sunny landings.", sub: "We're a foster-based rescue in the foothills — seniors and bonded pairs are our specialty, and every friend leaves with a story.", cta_label: "Meet the friends", cta_href: `/adopt/${DEMO_SLUG}` },
        { type: "adoptable_grid", heading: "Looking for a home right now", limit: 6 },
        { type: "quote", text: "They treated our nervous shepherd like he mattered from day one. Six weeks later he's asleep on our couch.", attribution: "Ranger's foster family" },
        { type: "cta_band", heading: "Lend a paw", text: "Adopt, foster, or fuel the kibble fund — every bit lands softly.", primary_label: "Adopt", primary_href: `/adopt/${DEMO_SLUG}`, secondary_label: "Donate", secondary_href: `/s/${DEMO_SLUG}/donate` },
        { type: "newsletter_signup", heading: "Small stories, monthly", text: "One email a month: arrivals, happy endings, zero spam." },
      ],
    ],
    [
      "dm_pg_about", "about", "Our story", "How a spare bedroom and three foster kittens became Sunny Meadow Rescue.",
      [
        { type: "hero", heading: "It started with three kittens in a spare bedroom", sub: "Eight years and 600 adoptions later, we're still small on purpose." },
        { type: "prose", md: "## Small on purpose\n\nWe keep our intake modest so every friend gets what they actually need — vet care without waitlists, foster homes instead of long kennel stays, and adopters we genuinely know.\n\n## What we believe\n\n- **Seniors are the best-kept secret** in rescue. Ask Pearl.\n- **Bonded pairs go home together.** No exceptions, no apologies.\n- **Fosters are the whole engine.** We just do the paperwork." },
      ],
    ],
    [
      "dm_pg_donate", "donate", "Donate", "Fuel the kibble fund — every dollar lands on a paw at Sunny Meadow Rescue.",
      [
        { type: "hero", heading: "Every dollar lands on a paw", sub: "We're volunteer-run. Donations go to vet care, food, and the occasional squeaky-toy emergency." },
        { type: "faq", heading: "Good questions", items: [
          { q: "Is my donation tax-deductible?", a: "Yes — we're a registered 501(c)(3) and every gift gets a receipt automatically." },
          { q: "Can I sponsor a specific animal?", a: "Absolutely. Sponsored fees (like Pearl's!) are our favorite kind of generosity." },
          { q: "Do you take supplies?", a: "Towels, unopened food, and sturdy toys — yes please. Drop them at Big Sky Feed & Supply." },
        ] },
        { type: "cta_band", heading: "The kennel roof fund is at 73%", text: "The spring hailstorm won round one. Round two is ours.", primary_label: "Give to the roof", primary_href: `/s/${DEMO_SLUG}/donate`, secondary_label: "", secondary_href: "" },
      ],
    ],
  ];
  for (const [id, slug, title, metaDesc, sections] of pages) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO pages (id, org_id, slug, title, layout, sections, meta_title, meta_description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'sections', ?, ?, ?, 'published', datetime('now','-30 days'), datetime('now','-2 days'))`,
      ).bind(id, ORG, slug, title, JSON.stringify(sections), `${title} — Sunny Meadow Rescue`, metaDesc),
    );
  }

  // ---- marketing ----
  stmts.push(
    env.DB.prepare(
      `INSERT INTO marketing_campaigns (id, org_id, name, objective, animal_id, key_message, source, created_at)
       VALUES ('dm_mc_pearl', ?, 'Pearl is still looking 💛', 'adoption_push', 'dm_an_pearl', 'Pearl''s fee is sponsored — the softest senior in the building is free to the right lap.', 'auto_long_stay', datetime('now','-4 days'))`,
    ).bind(ORG),
    env.DB.prepare(
      `INSERT INTO marketing_campaigns (id, org_id, name, objective, animal_id, key_message, source, created_at)
       VALUES ('dm_mc_hazel', ?, 'Hazel found home 🏡', 'success_story', 'dm_an_hazel', 'After 160 days, Hazel picked her people. Celebrate + thank the community.', 'auto_adoption', datetime('now','-7 days'))`,
    ).bind(ORG),
    env.DB.prepare(
      `INSERT INTO marketing_campaigns (id, org_id, name, objective, key_message, source, created_at)
       VALUES ('dm_mc_fair', ?, 'Summer Fair fundraiser', 'fundraiser', 'Kennel roof fund push at the Larkspur Summer Fair — booth 12, dunk tank at noon.', 'manual', datetime('now','-10 days'))`,
    ).bind(ORG),
  );
  const assets: [string, string, string, string, string, string, string | null, number][] = [
    // [id, campaign, channel, kind, title, content, meta, scheduledIn(0=none) — negative means posted N days ago]
    [
      "dm_ma_pearl_fb", "dm_mc_pearl", "facebook", "post", "Pearl's fee is covered",
      "Pearl is eleven, silk-soft, and completely over drama. She wants a sunbeam, your lap (on her schedule), and exactly zero chaos.\n\nHere's the thing: a kind neighbor already paid her adoption fee forward. The softest senior in the building is waiting on one thing — you.\n\nMeet Pearl: {{SITE_URL}}",
      "{}", 2,
    ],
    [
      "dm_ma_pearl_story", "dm_mc_pearl", "story", "story", "Pearl in 3 frames",
      "FRAME 1: Pearl asleep in the window sunbeam — 'This is Pearl. She's 11.'\nFRAME 2: Close-up of her judging the camera gently — 'Her fee? Already sponsored.'\nFRAME 3: Empty lap with an arrow pointing at it — 'She's missing one thing. Link up top.'",
      "{}", 3,
    ],
    [
      "dm_ma_hazel_ig", "dm_mc_hazel", "instagram", "post", "160 days → home",
      "One hundred and sixty days ago, Hazel arrived scared and skinny. Yesterday she left in a cat carrier lined with a blanket her new family brought from home — because they'd already decided she was theirs.\n\nTo everyone who shared her photos for five months: this one's yours too. 🧡",
      JSON.stringify({ hashtags: ["adoptdontshop", "seniorcatsofinstagram", "calicocat", "rescuecat", "larkspurco", "coloradorescue", "happyending", "fosterwin", "adoptacat", "catsofcolorado", "shelterlove", "foreverhome", "rescuestory", "catmom", "whiskerwednesday", "sunnymeadowrescue", "hazelfoundhome", "seniorpets"] }),
      -3,
    ],
    [
      "dm_ma_fair_email", "dm_mc_fair", "email", "email", "Dunk a volunteer, fix a roof ☀️",
      "Friends of Sunny Meadow,\n\nThe kennel roof fund is at 73% — and this Saturday we finish the job at the Larkspur Summer Fair.\n\nFind us at booth 12: adoptable friends from 10am, the famous volunteer dunk tank at noon (yes, Clare agreed; no, she doesn't know how cold the water is), and every dollar goes straight to the roof.\n\nCan't make it? The roof takes remote donations too: {{SITE_URL}}\n\nWith sunshine and sawdust,\nSunny Meadow Rescue",
      JSON.stringify({ altSubjects: ["73% of a roof + one dunk tank", "Saturday: friends, fair, final push"] }),
      4,
    ],
  ];
  for (const [id, campaign, channel, kind, title, content, meta, sched] of assets) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO marketing_assets (id, org_id, campaign_id, channel, kind, title, content, meta_json, scheduled_for, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${sched > 0 ? `date('now','+${sched} days')` : "NULL"}, ${sched < 0 ? `datetime('now','${sched} days')` : "NULL"})`,
      ).bind(id, ORG, campaign, channel, kind, title, content, meta),
    );
  }

  // batch in chunks (D1 batch cap safety)
  for (let i = 0; i < stmts.length; i += 40) {
    await env.DB.batch(stmts.slice(i, i + 40));
  }

  // ---- pre-canned AI insights so the Reports panel is alive without a key ----
  try {
    await env.CONFIG.put(`insights:${ORG}`, JSON.stringify(PRECANNED_INSIGHTS), { expirationTtl: 30 * 24 * 3600 });
  } catch {
    // KV hiccup — the panel just shows its empty state
  }

  // ---- photos: copy FLUX demo photos from static assets into R2 (best-effort) ----
  const art: [string, string, number][] = [];
  ANIMALS.forEach((a, i) => {
    if (a.art) art.push([a.id, a.art, i]);
  });
  // every historical friend gets their own photo — no repeats anywhere.
  // Index-aligned with HISTORY_NAMES (species formula: cat/dog/rabbit).
  const HISTORY_ART = [
    "demo-filler-cat1",   // Scout — brown tabby in the condo
    "demo-filler-dog1",   // Poppy — brown mix on the sidewalk
    "demo-filler-rabbit", // Otis — dutch rabbit with hay
    "demo-filler-cat2",   // Luna — tuxedo on the windowsill
    "demo-filler-dog2",   // Beans — black lab on the kennel cot
    "demo-filler-dog3",   // Duke — chihuahua mix in the yard
    "demo-h-willow",      // Willow — longhaired gray on the cat tree
    "demo-h-taco",        // Taco — corgi mix mid-walk
    "demo-h-ivy",         // Ivy — brindle pittie in a bandana
    "demo-h-bruno",       // Bruno — orange tom on the scratcher
    "demo-h-sage",        // Sage — schnauzer mix on the doormat
    "demo-h-pickles",     // Pickles — dachshund in a sweater
    "demo-h-nova",        // Nova — black cat, box too small
    "demo-h-chester",     // Chester — senior golden, white muzzle
    "demo-h-daisy",       // Daisy — heeler with the slobbery ball
    "demo-h-milo",        // Milo — siamese atop the bookshelf
    "demo-h-olive",       // Olive — pug mix, belly up
    "demo-h-rocket",      // Rocket — spotted rabbit mid-binky
    "demo-h-pepper",      // Pepper — gray & white in the paper bag
    "demo-h-finn",        // Finn — border collie catching a frisbee
  ];
  HISTORY_NAMES.forEach((_, i) => {
    if (HISTORY_ART[i]) art.push([`dm_an_h${i}`, HISTORY_ART[i], 100 + i]);
  });
  // Rows only, in a single batch — R2 objects materialize lazily on first
  // view via /api/media (per-request subrequest budgets are tight; a seed
  // that touched R2 33 times once died five photos in).
  try {
    const photoStmts = art.map(([animalId, name, i]) =>
      env.DB.prepare(
        `INSERT INTO animal_photos (id, org_id, animal_id, r2_key, kind) VALUES (?, ?, ?, ?, 'photo')`,
      ).bind(`dm_ph_${i}`, ORG, animalId, `orgs/${ORG}/photos/dm_${name}-${animalId}.webp`),
    );
    photoStmts.push(
      env.DB.prepare(
        `INSERT INTO animal_photos (id, org_id, animal_id, r2_key, kind) VALUES ('dm_ph_bonded', ?, 'dm_an_biscuit', ?, 'photo')`,
      ).bind(ORG, `orgs/${ORG}/photos/dm_demo-bonded.webp`),
    );
    await env.DB.batch(photoStmts);
  } catch (err) {
    console.log(`[demo photos failed] ${err instanceof Error ? err.message : err}`);
  }
}
