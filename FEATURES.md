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

All five run server-side on the Anthropic API, are audit-logged, never auto-apply output
(staff click to accept), and degrade to a friendly note until the **`ANTHROPIC_API_KEY`
Worker secret** is set — that single secret activates everything below plus the AI site designer.

| Feature | Status | Notes |
|---|---|---|
| Adopter–animal match quiz (public, `/adopt/:slug/match`) | 🟡 | Six questions → top matches from the shelter's real available animals, with reasons. Honeypot + per-IP (5/hr) and per-org (60/hr) rate limits |
| Application triage (score, green/red flags, better-fit suggestions, draft reply) | 🟡 | One click per application in the inbox; cached on the application; flags drawn only from what applicants actually wrote |
| Bio writer (adoption bio + Petfinder blurb + social post) | 🟡 | On the animal profile; staff type two facts, apply the bio only if they like it |
| Shelter insights (long-stay alerts, trends, cheap next steps) | 🟡 | On Reports; reads 12-month stats + longest-waiting friends; cached 7 days in KV, refresh anytime |
| Handoff summaries (warm adopter paragraph + clinical vet brief) | 🟡 | On the animal profile; built from real medical records and foster notes only |

## Adoption pipeline

| Feature | Status | Notes |
|---|---|---|
| Public adoption portal per org (`/adopt/:slug`) | ✅ | Org branding fields from Settings |
| Public animal pages with application form | ✅ | Honeypot spam protection |
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
