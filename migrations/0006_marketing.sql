-- Brand Studio + Marketing Studio + supporter email + SEO settings.
-- Brand tokens live in orgs.brand_json (no new columns needed).

CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  feature TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ai_usage_org ON ai_usage(org_id, created_at);

CREATE TABLE marketing_campaigns (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'evergreen', -- adoption_push|success_story|fundraiser|event|seasonal|evergreen|press
  animal_id TEXT REFERENCES animals(id),
  key_message TEXT,
  status TEXT NOT NULL DEFAULT 'draft',        -- draft|active|done
  source TEXT NOT NULL DEFAULT 'manual',       -- manual|auto_new_animal|auto_adoption|auto_long_stay
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mkt_campaigns_org ON marketing_campaigns(org_id, status);
CREATE INDEX idx_mkt_campaigns_entity ON marketing_campaigns(org_id, animal_id, source);

CREATE TABLE marketing_assets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id),
  channel TEXT NOT NULL,
  kind TEXT NOT NULL,                          -- post|story|script|email|article|press|ads
  title TEXT,
  content TEXT NOT NULL,
  meta_json TEXT,                              -- hashtags, alt subjects, ad variants, keywords…
  scheduled_for TEXT,                          -- date the shelter plans to post it
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mkt_assets_org ON marketing_assets(org_id, scheduled_for);
CREATE INDEX idx_mkt_assets_campaign ON marketing_assets(campaign_id);

CREATE TABLE email_suppression (
  org_id TEXT NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'unsubscribed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, email)
);

ALTER TABLE orgs ADD COLUMN seo_json TEXT; -- {visible, google_verify, bing_verify, og_image}
