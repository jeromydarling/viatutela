-- Cross-shelter adoption search + alerts, and the Adopter Radar feed.

ALTER TABLE orgs ADD COLUMN state TEXT; -- 2-letter US state, set in Settings

-- Platform-wide "tell me when my friend arrives" alerts (not org-scoped).
CREATE TABLE adopt_alerts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  species TEXT,                 -- null/any = all species
  keywords TEXT,
  state TEXT,                   -- null = anywhere in the US
  token TEXT NOT NULL,          -- unsubscribe token
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_notified_at TEXT         -- 24h cooldown between emails per alert
);
CREATE INDEX idx_adopt_alerts_state ON adopt_alerts(state);
CREATE UNIQUE INDEX idx_adopt_alerts_dedupe
  ON adopt_alerts(email, coalesce(state,''), coalesce(species,''), coalesce(keywords,''));

-- Public adoption-intent posts found on open networks (Bluesky, Reddit).
CREATE TABLE radar_posts (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,         -- bluesky | reddit
  post_key TEXT NOT NULL,       -- source-native id, dedupe key
  author TEXT,
  text TEXT NOT NULL,
  url TEXT NOT NULL,
  posted_at TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_radar_post_key ON radar_posts(source, post_key);
CREATE INDEX idx_radar_fetched ON radar_posts(fetched_at);
