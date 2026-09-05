-- Adopter Radar becomes opt-in (default off) and reply attempts are
-- tracked per org so shelters can see when others have already reached
-- out to the same public post — the fix for the pile-on risk: many
-- shelters independently see the identical global feed, and a stranger
-- who mentioned wanting a dog could otherwise get contacted by a dozen
-- different rescues with no coordination between them.

ALTER TABLE orgs ADD COLUMN radar_enabled INTEGER NOT NULL DEFAULT 0;

CREATE TABLE radar_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES radar_posts(id),
  org_id TEXT NOT NULL REFERENCES orgs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_radar_replies_dedupe ON radar_replies(post_id, org_id);
CREATE INDEX idx_radar_replies_post ON radar_replies(post_id);
