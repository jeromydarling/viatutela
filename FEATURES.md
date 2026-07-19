# Via Tutela — Feature List & Build Status

Honest inventory of what the product promises (marketing site + pricing tiers)
versus what is actually built and deployed. Updated 2026-07-19.

**Legend:** ✅ built & verified · 🟡 partial · ❌ not built yet

## Platform core

| Feature | Status | Notes |
|---|---|---|
| Marketing site (hero, pain/relief, savings calculator, comparison, pricing) | ✅ | SSR on the edge |
| Free migration importer (CSV/XLSX, no signup) | ✅ | Mapping auto-detect, 25-row preview, DO-backed processing, SSE progress, 5,000-row file in ~4s |
| Relationship preservation (adopter links, medical attachment, bonded pairs) | ✅ | Union-find bonded groups; fuzzy match by source key / name / microchip |
| Photo re-hosting to R2 during import | ✅ | 6/animal cap, 10MB cap, failures reported |
| Needs-attention report (file/row/field/reason CSV) | ✅ | |
| One-click claim → new org with all data promoted | ✅ | |
| Password accounts, sign in/out, session auth | ✅ | PBKDF2 (WebCrypto) |
| Multi-tenant isolation (org-scoped queries throughout) | ✅ | |

## Animal care & operations

| Feature | Status | Notes |
|---|---|---|
| Animal profiles (species, breed, kennel, chip, color, weight, bio, photos) | ✅ | |
| Search & filters (name, breed, chip, kennel, species, status) | ✅ | |
| Photo uploads to R2 | ✅ | |
| Medical timeline (add/remove records) | ✅ | |
| Printable kennel cards with QR | ✅ | Server-rendered SVG QR |
| Mobile QR quick-lookup (`/a/:id`) | ✅ | Staff see medical/chip/foster; public see adoption view; hidden animals stay hidden |
| Bonded-pair badges & cross-links | ✅ | |
| Vaccine/medical reminders | ✅ | "Next due" dates on records, dashboard "Coming up" panel with mark-handled, weekly Monday email digest per org (cron) |
| Multi-location | ✅ | Locations managed in Settings; assign on profiles, filter the list, census in Reports |
| Reports & analytics | ✅ | 12-month intake/adoption/donation charts, census by status/species/location, avg days-to-adoption, application funnel |

## Shelter websites (block CMS, AI designer, custom domains)

| Feature | Status | Notes |
|---|---|---|
| Block-based website CMS (12 section types, drag-free move/add/delete forms) | ✅ | Closed section enum + passthrough; 40-section / 120KB caps enforced |
| **5 site themes** (Meadow, Storybook, Bold, Playful, Classic) | ✅ | Whole design languages — radius, shadows, photo frames, heading treatment, section dividers (wave/scallop/paws/line), background textures. Picked in Brand Studio; AI brand-in-a-box proposes one |
| **Live preview pane** in the page editor | ✅ | Split-screen iframe, reloads on every save, desktop/phone toggle — WYSIWYG feel without a fragile editor engine |
| **Visual media picker** (library + animal photos) | ✅ | Every image field and the markdown toolbar can pick from uploaded media AND animals' own photos |
| **Markdown toolbar + inline images** | ✅ | B/i/H2/list/link buttons and `![alt](url)` image embeds in prose sections |
| **Per-section art direction** | ✅ | Background choice (default/white/tint) on every section; themed dividers auto-flow between sections |
| Public shelter sites (`/s/:slug/:page`) with brand accent + nav editor | ✅ | Live-gated by status + `publish_at`; draft pages 404 publicly |
| Starter-pack pages (home, about, adopt, get-involved, donate, contact) | ✅ | One click, created as drafts |
| Media library (R2-backed, required alt text) | ✅ | 10MB/image cap |
| Preview links (tokenized, 7-day expiry, noindex) | ✅ | KV-backed |
| Scheduled publishing (`publish_at`) | ✅ | |
| Per-tenant sitemap.xml + robots.txt | ✅ | Published pages + adoptable animals |
| AI site designer (interview → full draft site) | 🟡 | Fully coded (Anthropic API, drafts only, audit-logged). **Activation: set `ANTHROPIC_API_KEY` Worker secret.** Degrades to a friendly message until then |
| AI inline rewrites (warmer/punchier/shorter) + SEO meta drafting | 🟡 | Same activation lever |
| Custom domains (CNAME + auto-SSL via Cloudflare for SaaS) | 🟡 | Save/normalize/DNS-check/self-activation all built; runs in **manual mode** until Cloudflare for SaaS is enabled and `CF_API_TOKEN` (zone-scoped) + `CF_ZONE_ID` + `CUSTOM_DOMAIN_TARGET` are set |
| Tenant isolation on custom domains (staff app/login/API blocked) | ✅ | Only the public site surface is served on shelter hosts |

## AI for shelters (work smarter, match better)

All run server-side on the Anthropic API, are audit-logged, and never auto-apply output
(staff click to accept). **`ANTHROPIC_API_KEY` is set in production — every AI feature is live.**

Resilience: structured-output features **fall back to Workers AI (Llama 3.3 70B)** when the
Anthropic API is unconfigured or errors (vision + site designer stay Claude-only). Every AI call
is **budget-gated per org per day** from the `ai_usage` table — free 150k, rescue 750k, pro 2M
tokens/day (override with the `AI_DAILY_TOKEN_LIMIT` var); over-budget calls get a friendly
"refills at midnight UTC" message.

| Feature | Status | Notes |
|---|---|---|
| Adopter–animal match quiz (public, `/adopt/:slug/match`) | 🟡 | Six questions → top matches from the shelter's real available animals, with reasons. Honeypot + per-IP (5/hr) and per-org (60/hr) rate limits |
| Application triage (score, green/red flags, better-fit suggestions, draft reply) | 🟡 | One click per application in the inbox; cached on the application; flags drawn only from what applicants actually wrote |
| Bio writer (adoption bio + Petfinder blurb + social post) | 🟡 | On the animal profile; staff type two facts, apply the bio only if they like it |
| Shelter insights (long-stay alerts, trends, cheap next steps) | 🟡 | On Reports; reads 12-month stats + longest-waiting friends; cached 7 days in KV, refresh anytime |
| Handoff summaries (warm adopter paragraph + clinical vet brief) | 🟡 | On the animal profile; built from real medical records and foster notes only |

## Brand Studio (identity as data)

| Feature | Status | Notes |
|---|---|---|
| Brand tokens (palette ×4, logo/wordmark, typography pair, tagline, voice) | ✅ | Stored once; public site, guidelines, and social kit all render from them |
| Typeset wordmark as first-class logo (font/case/tracking/weight) | ✅ | Looks pro with zero design skills; never breaks in emails |
| AI brand-in-a-box (3 answers → full identity proposal) | 🟡 | Every enum whitelisted server-side; applied only on click. Needs `ANTHROPIC_API_KEY` |
| Import from old website (name, logo, dominant colors) | ✅ | Server-side fetch, 8s timeout, everything treated as untrusted |
| Brand guidelines page + downloadable social kit (profile pic, FB cover, share card) | ✅ | SVGs rendered from tokens; volunteers self-serve |
| Public sites render brand (fonts, palette CSS vars, wordmark header) | ✅ | Four curated Google-font pairings |
| Per-org AI usage tracking (`ai_usage` table) | ✅ | Feature label + token counts on every tracked call |

## Marketing Studio (channels, calendar, automations)

| Feature | Status | Notes |
|---|---|---|
| Campaigns (7 objectives, optional featured animal, key message) | ✅ | Nothing ever auto-publishes — drafts only, and the UI says so |
| Channel catalog as data — 11 channels (FB first, IG, story, reel, X, Pinterest, email, blog, press, Google ads, Meta ads) | ✅ | Per-channel JSON contracts drive prompts AND the UI; caps enforced server-side after parsing |
| Channel kit generation in the shelter's brand voice | 🟡 | Fan-out per selected channel. Needs `ANTHROPIC_API_KEY` |
| Content calendar (month view, schedule/move, mark posted) | ✅ | Plus an unscheduled tray |
| Content ideas from real data (longest-waiting, recent adoptions, season) | 🟡 | One-tap campaign starters |
| Auto-drafted campaigns (new animal → launch kit; adoption → success story; 60d+ waiting → weekly spotlight via cron) | ✅ | Idempotent guards; shells created even without AI; never posts anywhere |
| Supporter email (send email asset to newsletter+donor contacts) | 🟡 | HMAC unsubscribe tokens, per-org suppression table checked on every send, List-Unsubscribe one-click headers, `/unsub/:token`. Delivery needs the sender domain verified |
| Google Ad Grants nudge ($10k/mo free nonprofit search ads) | ✅ | Draft headlines/descriptions respect the character limits |

## SEO tooling

| Feature | Status | Notes |
|---|---|---|
| Per-shelter SEO settings (visibility toggle, Google/Bing verification, default OG image) | ✅ | Hidden = noindex everywhere, for pre-launch |
| Search Checkup (plain-language audit with one-tap fix links) | ✅ | Missing meta descriptions, photo-less adoptables, thin bios, verification, domain status — cheap SQL, no crawler |
| AnimalShelter JSON-LD on shelter homepages | ✅ | Plus OG tags everywhere and per-tenant sitemap/robots (already live) |

## Live demo

| Feature | Status | Notes |
|---|---|---|
| One-click demo at `/demo` (no signup) | ✅ | Auto-login into "Sunny Meadow Rescue" — a demo-flagged org with rich seeded content: 32 animals (bonded pair, long-stayers, foster glow-ups), a year of adoptions/donations for the charts, applications with a pre-canned AI review, published website, brand tokens, marketing campaigns mid-flight, pre-canned AI insights |
| Self-healing | ✅ | Seeds itself on first visit; cron resets all demo data every 6 hours so visitors can change anything |
| Entry points | ✅ | Marketing hero button + login page |

## Growth wave (waitlist, lifecycle, volunteers, grants, vision, network)

| Feature | Status | Notes |
|---|---|---|
| Interest waitlist + arrival alerts | ✅ | Public form on every adoption portal ("tell me when you get a senior cat"); new matching arrivals email subscribers automatically (suppression-aware, unsubscribe links, once per subscription) |
| Post-adoption lifecycle | ✅ | Day-3 / week-2 / month-6 check-ins + yearly Gotcha Day note with a gentle give ask; scheduled on every adoption, drained by daily cron, gotcha re-arms annually |
| Volunteer scheduling + hour log | ✅ | Shifts, sign-ups, auto-computed hours, 12-month totals and leaderboard — the hour log grant applications require |
| Grant-writer AI (`/app/grants`) | 🟡 | Drafts full funder narratives (need, program, outcomes, budget, sustainability) from real D1 stats incl. logged volunteer hours; drafts saved for editing. Needs `ANTHROPIC_API_KEY` |
| Intake vision (photos → draft profile) | 🟡 | Snap intake photos → species/breed/color/age guesses + first bio, prefilled into the add-friend form; every guess staff-reviewed. Needs key |
| Vet-record OCR (paper → medical rows) | 🟡 | Photograph paper records → structured, dated medical rows with due dates; reviewed before applying. Needs key |
| Cross-shelter transfer network (`/app/network`) | ✅ | Every Via Tutela rescue shares one board: need-space / have-space posts with urgency, species, counts; 14-day expiry; the network-effect feature |

## SMS (Twilio)

| Feature | Status | Notes |
|---|---|---|
| Twilio SMS layer (`workers/lib/sms.ts`) | 🟡 | REST API via fetch, never throws, E.164 normalization. **Activation: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` Worker secrets** |
| New-application text to the shelter | ✅ | Settings → "Text alerts number"; fires on every public application |
| Approval text to the adopter | ✅ | Sent alongside the approval email when the applicant left a phone |

## Adoption pipeline

| Feature | Status | Notes |
|---|---|---|
| Public adoption portal per org (`/adopt/:slug`) | ✅ | Org branding fields from Settings |
| Public animal pages with application form | ✅ | Honeypot spam protection; "I'd like to…" intent (adopt / meet / foster-to-adopt / question) flows into the inbox and AI triage |
| Share bar on every animal page (native share, FB, X, WhatsApp, Pinterest, Nextdoor, email, SMS, copy link/blurb, QR) | ✅ | Plain share intents, no tracking scripts |
| Printable branded adoption flyer (`…/flyer`) | ✅ | Brand tokens + big QR; print → Save as PDF |
| Embeddable widget (`…/embed`) with copyable iframe snippet | ✅ | For partner/community websites |
| Downloadable share kit (photos + blurb ZIP) | ✅ | `/api/share-kit/:slug/:animalId.zip`, 30MB cap |
| Videos on animal profiles & adoption pages | ✅ | Up to 50MB (mp4/webm/mov), plays inline on the public page |
| OG + Twitter cards with absolute animal photo | ✅ | Links unfurl beautifully in every messenger |
| Application inbox with approve/deny workflow | ✅ | Approve = adopter contact + adoption + status + foster close, one click |
| Manual adoption recording | ✅ | |
| Petfinder/Adopt-a-Pet **feed** (CSV URL) | 🟡 | Export feed in Petfinder format — not an authenticated API push; both sites can ingest scheduled feeds |

## People & community

| Feature | Status | Notes |
|---|---|---|
| Contact CRM with roles (adopter/foster/volunteer/donor/staff/vet) | ✅ | Rollups: adoptions, active fosters, lifetime giving |
| Foster coordination (start/end stays, notes, status sync) | ✅ | |
| Volunteer coordination | 🟡 | Volunteers exist as tagged contacts; no shift scheduling |
| Donor CRM (gifts, methods, top donors, 30d/YTD/all-time) | ✅ | |
| Fundraising campaigns with goals & progress bars | ✅ | |
| Donation receipts by email | ✅ | |
| Org to-do list (tasks with due dates, animal links) | ✅ | |

## Communication

| Feature | Status | Notes |
|---|---|---|
| Transactional email (Cloudflare Email Sending) | 🟡 | Fully wired & deployed: application received/approved/denied, donation receipts, welcome-home. **Activation needs a sender domain verified in the Cloudflare dashboard (Email → Sending) + set `EMAIL_FROM`.** Until then sends log & skip safely |
| SMS notifications | ❌ | Needs a provider decision (e.g. Twilio) |

## Money

| Feature | Status | Notes |
|---|---|---|
| Manual payment/donation tracking | ✅ | |
| Online payments via Stripe (fees, donations) | ❌ | Blocked on Stripe connector authorization; schema is ready |
| Billing / paid-tier subscriptions | ❌ | Everyone is on the free plan; no plan enforcement |

## Data freedom

| Feature | Status | Notes |
|---|---|---|
| One-click full export (ZIP of every table as CSV) | ✅ | |
| Source import files never mutated | ✅ | |

## Pricing-tier truth table

| Tier bullet | Status |
|---|---|
| Little Nest: importer, portal, QR cards, export | ✅ all built |
| Little Nest: "up to 25 animals" limit | ❌ not enforced (no billing yet, so nothing to gate) |
| Rescue: foster tools, donor CRM | ✅ |
| Rescue: email | 🟡 pending domain verification |
| Rescue: SMS | ❌ |
| Shelter Pro: fundraising campaigns | ✅ |
| Shelter Pro: Petfinder/Adopt-a-Pet sync | 🟡 feed built; API push not |
| Shelter Pro: multi-location | ✅ |
| Shelter Pro: reports & analytics | ✅ |
| Custom: SSO, pipelines, integrations | ❌ sales-tier scope, intentionally later |

## Remaining gaps (in suggested order)

1. **Plan limits + Stripe billing** — blocked on Stripe connector authorization
2. **Volunteer scheduling** (shifts, sign-ups)
3. **SMS** — blocked on provider decision (e.g. Twilio)
4. **Petfinder/Adopt-a-Pet API push** (feed URL already works for scheduled ingestion)
5. **AI activation** — set `ANTHROPIC_API_KEY` Worker secret to light up the site designer, rewrites, and SEO drafting
6. **Custom-domain automation** — enable Cloudflare for SaaS, then set `CF_API_TOKEN`/`CF_ZONE_ID`/`CUSTOM_DOMAIN_TARGET` (works in manual mode today)
