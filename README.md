# Tutela

**Every animal deserves a way home.** The all-in-one platform for shelters,
rescues, and fosters — move in free, keep your data, keep your money.

Built on Cloudflare Workers: React Router v7 (SSR) + Hono API + D1 + R2 +
Durable Objects + Workers AI.

## What's here (v1)

- **Marketing site** (`/`) — hero, pain/relief, interactive savings calculator,
  competitor comparison, pricing, all SSR on the edge.
- **Free migration importer** (`/import`) — the acquisition wedge:
  1. Upload messy CSV/XLSX exports (animals, contacts, medical, adoptions) — no account needed.
  2. Column mapping is auto-detected from an alias dictionary; adjust it in a mapping grid.
  3. Live preview of the first 25 normalized rows.
  4. Processing runs in an alarm-driven Durable Object (chunked, resumable — a
     5,000-row file cannot hit a request timeout), with progress streamed over SSE.
  5. Relationships are preserved: adopters ↔ animals, medical → animals, bonded
     pairs (union-find over `bonded_with` references), photos re-hosted to R2.
  6. Flagged rows land in a downloadable needs-attention report (file, row, field, reason).
  7. One click converts the finished import into a new free org (`/app` dashboard).
- **Multi-tenant schema** — orgs, users, sessions, animals, contacts, medical,
  adoptions, photos + staging tables scoped by import job and session token.

## Architecture notes

- One Worker serves everything: `workers/app.ts` routes `/api/*` to Hono and
  everything else to React Router SSR.
- `ImportProgress` (Durable Object) owns each import job: a persisted state
  machine (`rows → bond → photos → done`) advanced by alarms. The spec's Queue
  consumer was implemented as this DO because queue provisioning isn't
  available in this environment; the processing contract (streamed parse, no
  timeouts, batched D1 writes) is the same, and it can be swapped to a Queue
  by moving `tickRows` into a queue consumer later.
- Uploaded source files are written to R2 under `staging/<job>/uploads/` and
  **never mutated**.
- All import endpoints are scoped by an httpOnly session cookie; staged data
  can't leak across browser sessions.

## Develop

```sh
npm install
npm run db:migrate:local
npm run db:seed:local        # optional demo data
npm run dev                  # vite dev server with local bindings
npm run typecheck
```

Try the importer locally with the fixtures in `samples/` (deliberately messy:
mixed date formats, Excel serial dates, species aliases, a missing name, and
dangling references that should get flagged).

## Deploy

The Worker (`viatutela`) is connected to this GitHub repository via Cloudflare
Workers Builds — pushes to the production branch deploy automatically; other
branches get preview builds. Manual deploy: `npm run deploy`.

Migrations against production D1: `npm run db:migrate:remote` (needs
`CLOUDFLARE_API_TOKEN`/`wrangler login`). The initial migration for this repo
has already been applied to the remote database.

## Voice

Warm, plain, generous. Animals and people are friends and companions, never
inventory. See the microcopy in the importer for the tone: *"Welcome home.
Every one of them made it across safely."*

Peace and all good things to you and your animals.
