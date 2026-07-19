-- Integrations plumbing: per-org API keys, outbound webhooks, calendar feed.

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,               -- first characters, shown in the UI
  key_hash TEXT NOT NULL,             -- sha-256 hex of the full key; key itself is never stored
  scope TEXT NOT NULL DEFAULT 'read', -- read (write reserved for later)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX idx_api_keys_org ON api_keys(org_id);
CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);

CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,               -- HMAC secret, shown once at creation
  events TEXT NOT NULL,               -- comma list of subscribed events
  active INTEGER NOT NULL DEFAULT 1,
  failure_count INTEGER NOT NULL DEFAULT 0,  -- consecutive failures; auto-pause at threshold
  last_status TEXT,
  last_delivery_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_webhooks_org ON webhooks(org_id);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  webhook_id TEXT NOT NULL REFERENCES webhooks(id),
  event TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|ok|failed|dead
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);
CREATE INDEX idx_deliveries_retry ON webhook_deliveries(status, next_attempt_at);
CREATE INDEX idx_deliveries_org ON webhook_deliveries(org_id, created_at);

ALTER TABLE orgs ADD COLUMN ics_token TEXT;
