-- Starter-tier usage billing: one row per finalized adoption, in cents.
-- adoption_id is UNIQUE so an adoption can never be billed twice, no
-- matter how many times the event fires. stripe_synced_at is stamped
-- when the usage record is pushed to Stripe (integration pending).

CREATE TABLE billing_usage (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  adoption_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  stripe_synced_at TEXT
);
CREATE INDEX idx_billing_usage_org ON billing_usage(org_id, created_at);
