-- Platform subscription billing: shelters pay Tutela via a Stripe
-- subscription with a card on file. Distinct from stripe_account_id,
-- which is the Connect account shelters use to RECEIVE donations.

ALTER TABLE orgs ADD COLUMN stripe_customer_id TEXT;           -- platform customer
ALTER TABLE orgs ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'none'; -- none|active|past_due|canceled
ALTER TABLE orgs ADD COLUMN billing_method_on_file INTEGER NOT NULL DEFAULT 0; -- 1 once a card is added
ALTER TABLE orgs ADD COLUMN stripe_subscription_id TEXT;

CREATE INDEX idx_orgs_stripe_customer ON orgs(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
