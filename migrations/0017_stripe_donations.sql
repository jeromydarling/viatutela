-- Online giving: Stripe Connect per shelter, donation checkout tracking.

ALTER TABLE orgs ADD COLUMN stripe_account_id TEXT;
ALTER TABLE orgs ADD COLUMN stripe_charges_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE donations ADD COLUMN stripe_session_id TEXT;   -- idempotency for webhook recording
ALTER TABLE donations ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE donations ADD COLUMN fee_covered REAL;         -- extra the donor added to cover fees (dollars)

CREATE UNIQUE INDEX idx_donations_stripe_session ON donations(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX idx_orgs_stripe_account ON orgs(stripe_account_id) WHERE stripe_account_id IS NOT NULL;
