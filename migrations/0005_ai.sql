-- AI shelter features: cached application triage results.
-- (Match quiz is stateless, insights cache lives in KV, bios go into
-- animals.description only when staff explicitly apply them.)

ALTER TABLE applications ADD COLUMN ai_review_json TEXT;
