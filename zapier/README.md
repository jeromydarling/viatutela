# Tutela × Zapier

The official Zapier integration for [Tutela](https://viatutela.pet) — five instant
triggers (REST hooks), three create actions, and a contact search, all built on the
public `/api/v1` endpoints and per-org API keys.

| Piece | Key | Backed by |
|---|---|---|
| Trigger: New Adoption Application | `new_application` | webhook `application.created` |
| Trigger: Adoption Completed | `adoption_completed` | webhook `adoption.created` |
| Trigger: Donation Recorded | `new_donation` | webhook `donation.created` |
| Trigger: New Animal Added | `new_animal` | webhook `animal.created` |
| Trigger: Volunteer Shift Signup | `volunteer_signup` | webhook `volunteer.signup` |
| Search: Find Contact | `find_contact` | `GET /v1/contacts?email=` |
| Create: Find or Create Contact | `create_contact` | `POST /v1/contacts` |
| Create: Record Donation | `record_donation` | `POST /v1/donations` |
| Create: Add Animal | `create_animal` | `POST /v1/animals` |

Auth is a per-shelter API key (`Settings → Integrations`), sent as a Bearer token.
Triggers work with read-only keys; the create actions need a read + write key.

## Local test

```bash
cd zapier
npm install
npm test                       # schema/unit tests only
# against a running server:
BASE_URL=http://localhost:5173 TUTELA_API_KEY=vt_live_… npm test
```

## Publish (needs the Tutela Zapier account)

```bash
npm install -g zapier-platform-cli
zapier login                   # one-time, browser flow
cd zapier
zapier register "Tutela"       # one-time — creates the app on your account
zapier push                    # uploads this version
zapier validate                # checks against Zapier's publishing rules
```

Then in the [developer dashboard](https://developer.zapier.com):
1. Test one Zap end-to-end with a real Tutela key (turn a Zap on → confirm the
   subscription appears in Settings → Integrations → Webhooks, fire an event, watch it run).
2. Sharing → copy the **invite link** — that's the private beta. Anyone with the
   link can use the app; no Zapier review needed.
3. Public listing later requires ~3 active users and Zapier's review; the invite
   link is all a private beta needs.
