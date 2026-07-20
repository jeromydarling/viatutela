/**
 * The Field Guide — Tutela's in-app knowledge base. Every corner of the
 * app explained in plain, warm language, with special care for the
 * features people skip out of intimidation (looking at you, Zapier).
 *
 * Authoring rules: steps are numbered actions a person can follow
 * verbatim; tips are callouts; internal links use [text](/app/...) or
 * public paths and are validated by tests. Never promise something the
 * app doesn't do.
 */

export interface HelpBlock {
  h2?: string;
  p?: string;
  list?: string[];
  steps?: string[];
  tip?: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  emoji: string;
  category: HelpCategory;
  summary: string;
  blocks: HelpBlock[];
}

export const HELP_CATEGORIES = [
  "Getting started",
  "Animals",
  "People & adoptions",
  "Money",
  "Website & brand",
  "Marketing & growth",
  "Integrations & automation",
  "Account & data",
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

export const HELP: HelpArticle[] = [
  // ------------------------------------------------------------ getting started
  {
    slug: "welcome",
    title: "A five-minute tour",
    emoji: "🌻",
    category: "Getting started",
    summary: "What lives where, and the fastest path from empty workspace to working shelter.",
    blocks: [
      {
        p: "Everything in Tutela hangs off the top navigation. Dashboard is your morning coffee view — new applications, medical due dates, tasks. Animals is the heart. People holds every human: adopters, fosters, volunteers, donors. The rest are exactly what they say: Applications, Fosters, Volunteers, Donations, Grants, Network, Website, Brand, Marketing, Radar, Reports, Settings.",
      },
      {
        h2: "The fastest good start",
        steps: [
          "Coming from other software? Run the [free importer](/import) first — it preserves adopter histories, medical records, and bonded pairs.",
          "Starting fresh? [Add your first friend](/app/animals/new) — or photograph them and let AI draft the profile.",
          "Open [Settings](/app/settings) and fill in your shelter's name, email, address, and state.",
          "Visit the [Brand Studio](/app/brand) — three answers and it proposes colors, a wordmark, and a website theme.",
          "Publish your [website](/app/website) — starter pages are drafted and waiting.",
        ],
      },
      {
        tip: "The dashboard checklist tracks these same steps and disappears once you're set up. And the [demo shelter](/demo) is always there when you want to see a fully-populated workspace — click anything, it resets every six hours.",
      },
    ],
  },
  {
    slug: "importing",
    title: "Importing your data",
    emoji: "📦",
    category: "Getting started",
    summary: "Move everything from your old system — animals, people, adoptions, medical, photos — without losing a single relationship.",
    blocks: [
      {
        p: "The importer is free, needs no account to try, and was built for messy real-world exports. It reads CSV and Excel files from any shelter system and preserves the connections most migrations lose: who adopted whom, which medical rows belong to which animal, which friends are bonded pairs.",
      },
      {
        h2: "Step by step",
        steps: [
          "Export everything from your old system as CSV or Excel — animals, people, adoptions, medical records. Don't clean anything; mess is fine, missing is not.",
          "Go to [the importer](/import) and drop all the files in at once. It guesses what each file is and maps the columns automatically.",
          "Review the mapping grid — every guess is shown and changeable. Unmapped columns are simply skipped, never lost silently.",
          "Run the preview. Flagged rows are listed with reasons; fix the flagged few, not the thousands.",
          "Process, then claim the import into your workspace. Everything lands connected.",
        ],
      },
      {
        tip: "Export from your old system BEFORE canceling your subscription — some systems disable exports the day you lapse.",
      },
      {
        p: "Photos: if your export references photo URLs, the importer fetches what it can and reports what it couldn't. You can always add photos later from each profile.",
      },
    ],
  },
  {
    slug: "settings-basics",
    title: "Settings: the ten-minute foundation",
    emoji: "⚙️",
    category: "Getting started",
    summary: "Org details, your state, locations, and inviting teammates.",
    blocks: [
      {
        p: "Ten minutes in [Settings](/app/settings) makes everything else work better. Your shelter's name, email, and phone appear on your public pages and outgoing emails. Your address feeds your website's structured data (local SEO). Your state powers Tutela's cross-shelter adoption search and alert matching.",
      },
      {
        h2: "Worth doing early",
        list: [
          "Set your state — it connects your animals to adopters searching nearby.",
          "Add locations if you have more than one building or a foster network — animals can be assigned and filtered by location.",
          "Invite teammates — they get full workspace access and their own logins. Remove someone and their sessions end everywhere, instantly.",
          "Bookmark your public links (adoption page, Petfinder feed) — they're listed in Settings.",
        ],
      },
      { tip: "Everything you enter is always yours: the 'Own your data' section downloads a complete export as plain CSVs, any time, no strings." },
    ],
  },
  // ------------------------------------------------------------ animals
  {
    slug: "animal-profiles",
    title: "Animal profiles",
    emoji: "🐾",
    category: "Animals",
    summary: "Profiles, statuses, kennel cards, bonded pairs, and the publish toggle.",
    blocks: [
      {
        p: "A profile holds everything about one friend: photos and videos, medical timeline, foster status, notes, microchip, kennel. Statuses (available, pending, in foster, hold, adopted) keep lists and public pages honest automatically.",
      },
      {
        h2: "The parts people miss",
        list: [
          "🌐 Publish toggle — one switch puts a friend on your website, adoption page, and Petfinder feed at once (and fires your waitlist + adoption alerts).",
          "Kennel QR card — print it, tape it to the kennel, and the full profile opens on any phone in the kennel aisle.",
          "Bonded pairs — link friends who go home together; every public surface enforces and celebrates it.",
          "📰 Press kit — on public profiles, one click downloads a press release, fact sheet, and photos for your local paper's pet-of-the-week.",
          "Make lead photo — the star photo shows first everywhere.",
        ],
      },
      {
        p: "Adding by camera: on [New friend](/app/animals/new), snap intake photos and AI drafts species, markings, an age estimate, and a first bio. Every guess is labeled and nothing saves until you approve it.",
      },
    ],
  },
  {
    slug: "photo-studio",
    title: "The photo studio",
    emoji: "📸",
    category: "Animals",
    summary: "AI photo review, one-tap enhancement, clean backdrops, social crops, and alt text.",
    blocks: [
      {
        p: "Photos drive adoptions more than anything else on a profile. The studio (on every animal's Photos section) helps without ever faking: it enhances what the camera captured, never fabricates what it didn't.",
      },
      {
        h2: "The four buttons",
        list: [
          "Review photos — AI ranks your shots, suggests the best lead photo, and writes alt text for accessibility.",
          "Enhance — brightness, contrast, and sharpness suggestions you preview before applying. The original is always kept; revert any time.",
          "Clean backdrop — lifts your friend off a cluttered background onto a warm cream one. Great for kennel shots.",
          "Social crops — square, portrait, and landscape versions sized for every platform, cropped around your friend.",
        ],
      },
      { tip: "Phone photography beats equipment: get low (their eye level), find window light, and take twenty shots to keep two. The [photo guide](/guides/shelter-photos-phone) has the full method." },
    ],
  },
  {
    slug: "medical-records",
    title: "Medical records & reminders",
    emoji: "💉",
    category: "Animals",
    summary: "Vaccine timelines, due dates, the weekly digest, and turning vet paperwork into rows with OCR.",
    blocks: [
      {
        p: "Each animal's medical tab is a dated timeline: vaccines, exams, surgeries, treatments, notes. Anything with a due date feeds the dashboard's 'coming due' list and the Monday-morning medical digest email.",
      },
      {
        h2: "The paperwork trick",
        steps: [
          "Open a profile's medical section and choose the vet-records scanner.",
          "Photograph the paperwork that came with the transfer — crumpled is fine.",
          "AI reads it into dated rows with types and due dates, each labeled as a guess.",
          "Approve, fix, or discard row by row. Nothing saves itself.",
        ],
      },
      { tip: "Enter due dates even for far-future boosters — future-you gets the reminder exactly when it matters." },
    ],
  },
  // ------------------------------------------------------------ people & adoptions
  {
    slug: "people-crm",
    title: "People: your gentle CRM",
    emoji: "🧑‍🤝‍🧑",
    category: "People & adoptions",
    summary: "One list for adopters, fosters, volunteers, donors — with roles, history, and search.",
    blocks: [
      {
        p: "Every human lives in [People](/app/people) with roles (adopter, foster, volunteer, donor, newsletter) that can stack — your best volunteer might be a donor and a foster too. Each person's page shows their whole history with your shelter.",
      },
      {
        list: [
          "Roles are checkboxes on each person — tick volunteer and they appear on the Volunteers roster immediately.",
          "Approving an application creates or updates the adopter automatically, role included.",
          "Online donations create donor contacts automatically (matched by email).",
          "Newsletter signups from your website land here with the newsletter role.",
        ],
      },
      { tip: "Big list? Use the search box and role filter; pages of 120 keep it fast at any size." },
    ],
  },
  {
    slug: "applications",
    title: "Applications & the AI triage",
    emoji: "📮",
    category: "People & adoptions",
    summary: "From 'someone applied!' to a recorded adoption in two clicks — with AI reading the pile first.",
    blocks: [
      {
        p: "Applications from your adoption pages land in [one inbox](/app/applications) and text/email your team the moment they arrive. Each gets an AI read: a fit score, green and red flags drawn only from what the applicant wrote, and a drafted warm reply. AI ranks and flags — a human always decides.",
      },
      {
        h2: "Approving",
        steps: [
          "Open the application and skim the flags — they cite the applicant's own words.",
          "Click Approve. Tutela records the adoption, marks the friend adopted, ends any foster stay, creates/updates the adopter contact, and sends the happy email (and a text if they left a number).",
          "Post-adoption check-ins schedule themselves — day 3, week 2, and the one-year gotcha day.",
        ],
      },
      { tip: "Denying kindly matters: the built-in gentle denial keeps the door open — today's 'not this friend' is next year's perfect adopter." },
    ],
  },
  {
    slug: "fosters",
    title: "Fosters",
    emoji: "🏠",
    category: "People & adoptions",
    summary: "Start and end stays in two clicks; statuses keep themselves honest.",
    blocks: [
      {
        p: "[Fosters](/app/fosters) tracks who's staying where. Start a stay and the animal's status flips to 'in foster'; end it and everything updates. Approving an adoption for a fostered friend ends the stay automatically.",
      },
      {
        list: [
          "Foster homes are just People with the foster role — history included.",
          "Bonded pairs can foster together; the pair stays visible everywhere.",
          "The dashboard counts active stays so capacity is never a mystery.",
        ],
      },
    ],
  },
  {
    slug: "volunteers-shifts",
    title: "Volunteers, shifts & hours",
    emoji: "🙌",
    category: "People & adoptions",
    summary: "A roster, a shift calendar people can subscribe to, and hours that log themselves for grant season.",
    blocks: [
      {
        p: "[Volunteers](/app/volunteers) shows your roster (everyone with the volunteer role), upcoming shifts, and total logged hours — the number grant applications always ask for.",
      },
      {
        h2: "Shifts",
        steps: [
          "Create a shift with a title, date, times, and how many slots.",
          "Sign volunteers up — hours compute from the shift times automatically.",
          "Share the calendar: Settings → Integrations has a link the whole crew can subscribe to in Google or Apple Calendar. New shifts just appear.",
        ],
      },
      { tip: "Hours export with everything else — and the grant writer pulls them into drafts automatically." },
    ],
  },
  {
    slug: "adopter-experience",
    title: "What adopters see",
    emoji: "💛",
    category: "People & adoptions",
    summary: "Your adoption page, the match quiz, waitlist alerts, and the cross-shelter search.",
    blocks: [
      {
        p: "Your public adoption page lists every published friend with filters that appear as your list grows. Each profile has photos, videos, the story, bonded-pair callouts, and an application form that starts a conversation.",
      },
      {
        list: [
          "Match quiz — adopters answer six questions and AI ranks your actual available friends for their home.",
          "Waitlist — 'tell me when you get a senior cat' captures visitors you'd otherwise lose; matching arrivals email them automatically, once.",
          "Cross-shelter alerts — adopters anywhere can set alerts on Tutela's shared search; when your new friend matches, they hear about your shelter.",
          "Share bar, flyers, embeds — every profile is built to travel: one-click flyer PDFs, an embed widget for partner sites, share links that unfurl beautifully.",
        ],
      },
    ],
  },
  // ------------------------------------------------------------ money
  {
    slug: "donations",
    title: "Recording donations & campaigns",
    emoji: "💚",
    category: "Money",
    summary: "Gifts, campaigns with progress bars, automatic receipts, and top-donor visibility.",
    blocks: [
      {
        p: "[Donations](/app/donations) records every gift — cash at an event, a check in the mail, or online giving. Attach gifts to campaigns to get goals with progress bars; thank-you receipts email automatically when you have the donor's address.",
      },
      {
        list: [
          "Link gifts to a contact and their giving history builds itself.",
          "Campaigns show raised-vs-goal — perfect for the kennel-roof fund.",
          "Every donation can trigger your automations (Slack, bookkeeping, thank-you tasks) — see the Zapier guide below.",
        ],
      },
    ],
  },
  {
    slug: "online-giving",
    title: "Online giving (Stripe)",
    emoji: "💳",
    category: "Money",
    summary: "Your own donate page with one-time and monthly gifts — donors cover the fees, you're the merchant of record.",
    blocks: [
      {
        p: "Online giving gives your shelter a donate page at your own link with one-time and monthly options. You connect your own Stripe account, so payouts go straight to your bank and receipts carry your shelter's name.",
      },
      {
        h2: "Setup (about ten minutes)",
        steps: [
          "On [Donations](/app/donations), click 'Set up online giving'.",
          "Stripe walks you through their onboarding — your org's details and bank account.",
          "Back in Tutela the card flips to live and shows your donate link. Share it everywhere; add it to your website nav.",
        ],
      },
      {
        h2: "The honest fee math",
        p: "Donors see a checked-by-default option to add a small amount (about $1.60 on a $25 gift) covering card processing plus Tutela's 2% platform fee — clearly labeled, never hidden. Most donors leave it checked, which means gifts reach you whole. Monthly giving is the quiet powerhouse: industry-wide it's about a quarter of online fundraising revenue.",
      },
      { tip: "Every online gift records itself, creates or updates the donor contact, and fires your donation automations." },
    ],
  },
  {
    slug: "grants",
    title: "The grant writer",
    emoji: "📝",
    category: "Money",
    summary: "AI drafts full grant narratives from your real numbers — you edit and submit.",
    blocks: [
      {
        p: "[Grants](/app/grants) drafts application narratives from your actual outcomes: intake and adoption counts, volunteer hours, donation totals. It never invents a statistic — where a number would go, it uses yours or leaves a clearly-marked blank.",
      },
      {
        list: [
          "Works for the usual suspects — Petco Love, Best Friends, community foundations — and generic narratives you can adapt.",
          "Everything is a draft: edit in place, then copy into the funder's form.",
          "Pair it with volunteer hours (logged automatically from shifts) and your Reports numbers for a complete package.",
        ],
      },
    ],
  },
  // ------------------------------------------------------------ website & brand
  {
    slug: "website-builder",
    title: "The website builder",
    emoji: "🌐",
    category: "Website & brand",
    summary: "Block-based pages, themes, live preview, scheduling, and the AI site designer.",
    blocks: [
      {
        p: "[Website](/app/website) is a block CMS: pages are stacks of sections (hero, adoptable grid, story, donate, newsletter…) you reorder and edit with a live preview pane. Starter pages are drafted at signup — most shelters publish a real site in an afternoon.",
      },
      {
        list: [
          "The AI designer interviews you (five questions) and drafts the whole site in your voice.",
          "Five design themes restyle everything at once; the media picker pulls straight from your animals' photos.",
          "Preview links let your board see drafts; publishing can be scheduled.",
          "Adoptable grids are live — they always show current available friends, no upkeep.",
        ],
      },
    ],
  },
  {
    slug: "custom-domain",
    title: "Your own domain",
    emoji: "🔗",
    category: "Website & brand",
    summary: "Point a CNAME, get automatic SSL, and your site lives at yourshelter.org.",
    blocks: [
      {
        steps: [
          "In [Website → Domain](/app/website/domain), enter your domain.",
          "At your registrar, add the CNAME record shown on that page.",
          "Wait for DNS (minutes to a few hours). SSL issues automatically — no certificates to manage, ever.",
        ],
      },
      { tip: "Your sitemap and robots.txt are generated automatically on your domain; submit the sitemap once in Google Search Console (see the SEO checkup)." },
      {
        p: "While you wait for DNS, everything keeps working at your built-in address — the custom domain simply becomes another door to the same site. Staff logins and private pages are never served on your public domain; only your website and adoption pages travel there.",
      },
    ],
  },
  {
    slug: "seo-and-analytics",
    title: "SEO checkup & analytics trackers",
    emoji: "🔍",
    category: "Website & brand",
    summary: "The getting-found checklist, search-engine verification, and adding GA4/Meta Pixel/Plausible the safe way.",
    blocks: [
      {
        p: "[Website → SEO](/app/website/seo) is two things: a settings panel and an honest checklist of what actually affects getting found — published pages, meta descriptions, photos and bios on every adoptable friend, a connected domain.",
      },
      {
        h2: "Analytics without the scary paste-this-code step",
        p: "Want Google Analytics, Tag Manager, Meta Pixel, or Plausible on your public site? Paste just the ID (like G-ABC123). Tutela validates the format and renders the official snippet for you — raw code is never accepted, so nothing unexpected can ever run on your pages. Disclose your trackers in your own privacy policy; they're yours.",
      },
      { tip: "The 'visible to search engines' switch adds noindex everywhere when off — flip it on when you're ready to launch." },
    ],
  },
  {
    slug: "brand-studio",
    title: "The Brand Studio",
    emoji: "🎨",
    category: "Website & brand",
    summary: "Colors, wordmark, typography, and voice — proposed by AI, applied everywhere at once.",
    blocks: [
      {
        p: "[Brand](/app/brand) keeps your look in one place: palette, wordmark, fonts, and voice notes. Answer three questions and AI proposes a complete brand; or import colors from an existing logo. Apply, and your website, adoption pages, and donate page all dress accordingly.",
      },
      {
        list: [
          "Brand guidelines page — share it with volunteers making flyers.",
          "Everything is editable after AI proposes; nothing applies without you.",
        ],
      },
    ],
  },
  // ------------------------------------------------------------ marketing & growth
  {
    slug: "marketing-studio",
    title: "The Marketing Studio",
    emoji: "📣",
    category: "Marketing & growth",
    summary: "Campaign kits across eleven channels, a content calendar, supporter email, and automatic moments.",
    blocks: [
      {
        p: "[Marketing](/app/marketing) drafts campaigns in your brand voice across channels — Facebook, Instagram, press releases, Google Ad Grants, supporter email, and more — arranged on a calendar. New arrival? A launch kit appears. Adoption? A success story is waiting.",
      },
      {
        list: [
          "Supporter emails send to your contacts with polite one-click unsubscribe (suppression handled for you).",
          "Long-stay spotlights draft themselves on a schedule — the friends who need the push get it.",
          "Every draft is a draft: nothing posts or sends without a human.",
        ],
      },
    ],
  },
  {
    slug: "adopter-radar",
    title: "Adopter Radar",
    emoji: "📡",
    category: "Marketing & growth",
    summary: "Real people publicly saying 'we want to adopt' — surfaced for you to answer as yourself.",
    blocks: [
      {
        p: "Every few hours, [Radar](/app/radar) sweeps public posts on Bluesky and Reddit for people saying they're ready to adopt, filtered to weed out the false positives. Filter by your city or interests, and when someone sounds nearby, reply — as yourself, from your own account.",
      },
      {
        h2: "Using it well",
        steps: [
          "Filter by your city, region, or state abbreviation.",
          "Click '✨ Draft a warm reply' — AI writes a friendly, non-salesy hello with your adoption link.",
          "Tweak it so it sounds like you, open the post, and reply from your own account.",
        ],
      },
      {
        tip: "Tutela never auto-posts, auto-replies, or messages anyone — and neither should you via automation. One genuine local human beats a hundred bot replies, and platforms ban the bots anyway.",
      },
    ],
  },
  {
    slug: "sharing-and-press",
    title: "Sharing, flyers & the press kit",
    emoji: "🗞️",
    category: "Marketing & growth",
    summary: "Share bars, flyer PDFs, embeds, the share kit, Petfinder feed, and pet-of-the-week press kits.",
    blocks: [
      {
        list: [
          "Share bar — on every public profile, one tap to every network your volunteers use.",
          "Flyer — a print-ready PDF per friend, QR code included.",
          "Embed — a small widget any partner site (your vet!) can paste.",
          "Share kit — a zip of photos + ready-to-paste text anyone can download from the profile.",
          "📰 Press kit — press release, fact sheet, and photos per friend; email it to your local paper or TV station's pet-of-the-week segment. They are starved for exactly this.",
          "📖 Booklet — a print-ready PDF keepsake (cover, story, particulars, QR back page). Email it to adopters or print it as a going-home gift.",
          "Petfinder-format feed — a live CSV link (in Settings) to point Petfinder/Adopt-a-Pet imports at.",
        ],
      },
      { tip: "Local media loves a recurring relationship: send one press kit a week to the same reporter and become their easiest segment." },
    ],
  },
  // ------------------------------------------------------------ integrations
  {
    slug: "first-zap",
    title: "Your first Zap, step by step",
    emoji: "⚡",
    category: "Integrations & automation",
    summary: "The complete, no-fear walkthrough: applications posting themselves into Slack in about ten minutes.",
    blocks: [
      {
        p: "If you've never used Zapier: it's a service that listens for 'something happened over here' and does 'something over there' — no code, ever. This walkthrough wires one automation end to end: every new adoption application posts into your team's Slack channel. Once you've done one, you can do all twenty in the [recipe library](/app/settings/integrations/recipes).",
      },
      {
        h2: "Part 1 — catch the event (5 minutes)",
        steps: [
          "Create a free account at zapier.com and click 'Create Zap'.",
          "For the trigger, search 'Webhooks by Zapier' and choose it. Pick the event type 'Catch Hook'. (Heads-up: webhooks are a paid-plan Zapier feature — Make.com's free tier does the same job if you prefer.)",
          "Zapier shows you a URL that looks like hooks.zapier.com/hooks/catch/… — copy it.",
          "In Tutela, open [Settings → Integrations](/app/settings/integrations), paste that URL in the Webhooks section, tick 'New adoption application', and click Add webhook. Save the signing secret it shows you somewhere safe (you likely won't need it, but it's shown only once).",
          "Click 'Send test ping' next to your new webhook. Back in Zapier, click 'Test trigger' — Zapier catches the ping. That's the two ends connected.",
        ],
      },
      {
        h2: "Part 2 — do something with it (5 minutes)",
        steps: [
          "For the action, choose Slack → 'Send Channel Message' and connect your Slack workspace when asked.",
          "Pick the channel (say, #adoptions).",
          "In the message text, type something like: 🐾 New application for — then click into Zapier's field picker and insert the field called animal_name from the caught data. Continue: from, then insert name, then (, insert email, ).",
          "Test the action — a message appears in Slack. Turn the Zap on.",
          "Real test: submit an application on your own adoption page. Watch it appear in Slack. That's it — it now runs forever.",
        ],
      },
      {
        h2: "When something doesn't work",
        list: [
          "Zapier caught nothing? Re-check the URL you pasted in Tutela matches exactly, then Send test ping again.",
          "Fields look empty in the editor? Use 'Send test ping' or submit a real application first — Zapier needs one example to show fields.",
          "Delivery log (bottom of the Integrations page) shows every attempt and the exact response — 'HTTP 200' means delivered.",
          "A webhook that fails repeatedly pauses itself; fix the Zap and press Resume.",
        ],
      },
      {
        tip: "The [recipe library](/app/settings/integrations/recipes) has ready-made instructions for all five events — donations into bookkeeping, adoptions into Mailchimp, new friends onto your Google Business Profile. Each one is this same pattern with a different last step.",
      },
    ],
  },
  {
    slug: "api-keys-webhooks",
    title: "API keys & webhooks, explained",
    emoji: "🔑",
    category: "Integrations & automation",
    summary: "What the keys and webhooks actually are, what's safe, and what the payloads contain.",
    blocks: [
      {
        p: "Two building blocks live in [Settings → Integrations](/app/settings/integrations). An API key lets another tool READ your data (or write, if you create a read+write key) — it's shown once, stored scrambled, and revocable in one click. A webhook is the reverse: Tutela PUSHES a small message to a URL you chose whenever something happens.",
      },
      {
        h2: "Good to know",
        list: [
          "Five events: application.created, adoption.created, donation.created, animal.created, volunteer.signup.",
          "Payloads carry the minimum useful fields — never medical records, never passwords.",
          "Every delivery is signed (HMAC) so the receiving end can verify it's really from Tutela; failed deliveries retry with backoff and everything is visible in the delivery log.",
          "Webhook URLs must be public https — never a password, never your login.",
          "The read API serves /api/v1/animals, contacts, applications, donations, adoptions with an Authorization: Bearer header — 120 requests/minute.",
        ],
      },
      { tip: "Rule of thumb: paste IDs and URLs, never credentials. Anything you connect can be revoked from this page in one click, and revocation is instant." },
    ],
  },
  {
    slug: "calendar-feed",
    title: "The shift calendar feed",
    emoji: "📅",
    category: "Integrations & automation",
    summary: "Volunteers subscribe once in Google or Apple Calendar and every shift just appears.",
    blocks: [
      {
        steps: [
          "Copy the calendar link from [Settings → Integrations](/app/settings/integrations).",
          "Google Calendar: Other calendars → + → From URL → paste. Apple Calendar: File → New Calendar Subscription.",
          "Share the link with your volunteer crew — anyone with it sees shift titles and times (nothing else).",
        ],
      },
      { tip: "Regenerating the link (same page) instantly revokes the old one — useful if it escapes into the wild." },
    ],
  },
  // ------------------------------------------------------------ account & data
  {
    slug: "your-data",
    title: "Your data is yours",
    emoji: "📤",
    category: "Account & data",
    summary: "The one-click full export, what's in it, and our promises.",
    blocks: [
      {
        p: "Settings → 'Own your data' downloads a zip of every table you own as plain CSVs — animals, people, adoptions, medical, donations, pages, everything — plus a README. No strings, no lock-in, no export fees, works on day one and day one thousand.",
      },
      {
        list: [
          "Passwords and secrets are never exported (or exportable).",
          "Photos are referenced by URL in the export — fetch any of them from your media links.",
          "The [privacy policy](/privacy) is the plain-language version of all our promises.",
        ],
      },
    ],
  },
  {
    slug: "team-security",
    title: "Team & security",
    emoji: "🔒",
    category: "Account & data",
    summary: "Invites, sessions, sign-out-everywhere, and how sign-in is protected.",
    blocks: [
      {
        p: "Shelters run on shared computers, borrowed laptops, and volunteers who come and go — so access control is built to be boring and fast, not an IT project.",
      },
      {
        list: [
          "Invite teammates from [Settings](/app/settings) — each gets their own login; seats depend on your plan.",
          "Removing a teammate ends their sessions everywhere, immediately.",
          "Sign-in is rate-limited against password guessing; passwords are stored properly hashed, never readable.",
          "API keys and webhooks are org-scoped and one-click revocable — see the integrations articles.",
        ],
      },
    ],
  },
  {
    slug: "pricing-billing",
    title: "Pricing, plainly",
    emoji: "🧾",
    category: "Account & data",
    summary: "What each tier costs, what the $1/adoption means, and the online-giving 2%.",
    blocks: [
      {
        p: "Starter is $9/month plus $1 per adoption recorded, and the per-adoption fees cap at $30 a month — a busy month can never cost you more than the flat Rescue tier would have. Rescue is $39/month flat. Shelter Pro is $79/month flat. Every feature is on every plan; tiers differ by scale, not by held-back features. (And yes — marking a friend adopted always records the adoption, however you do it: it's what powers the check-ins, the stats, and the celebration.)",
      },
      {
        p: "Online giving, if you use it, carries a 2% platform fee that donors are asked to cover at checkout (clearly labeled, and most do). The importer is free forever, account or not. No setup fees, no export fees, no surprise line items — the [pricing section](/#pricing) and savings calculator show the full math.",
      },
    ],
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP.find((a) => a.slug === slug);
}

export function helpByCategory(): { category: HelpCategory; articles: HelpArticle[] }[] {
  return HELP_CATEGORIES.map((category) => ({
    category,
    articles: HELP.filter((a) => a.category === category),
  })).filter((g) => g.articles.length > 0);
}
