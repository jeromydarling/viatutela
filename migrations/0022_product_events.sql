-- Lightweight internal usage telemetry: which screens orgs actually
-- reach, and the milestone moments (signup, import, first animal, first
-- application, first adoption). Without this, churn is a mystery — we
-- can see an org went quiet but never know whether they stalled at
-- import, got lost in settings, or never made it past login.

CREATE TABLE product_events (
  id TEXT PRIMARY KEY,
  org_id TEXT,               -- null for pre-signup events (e.g. import completed pre-claim)
  user_id TEXT,
  event TEXT NOT NULL,       -- 'page_view' | 'signup' | 'import_completed' | 'first_animal' | ...
  path TEXT,                 -- for page_view: the route path
  meta TEXT,                 -- optional small JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_product_events_org ON product_events(org_id, created_at);
CREATE INDEX idx_product_events_event ON product_events(event, created_at);
