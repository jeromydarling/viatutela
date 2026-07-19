-- Via Tutela v4 — shelter websites: block CMS, media library, domains, AI audit

CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT 'standard', -- standard | hero | wide
  hero_image_url TEXT,
  hero_eyebrow TEXT,
  subtitle TEXT,
  sections TEXT NOT NULL DEFAULT '[]',     -- JSON array of typed sections
  body_md TEXT,                            -- markdown fallback for simple pages
  meta_title TEXT,
  meta_description TEXT,
  publish_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',    -- draft | published
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, slug)
);
CREATE INDEX idx_pages_org ON pages(org_id, status);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  r2_key TEXT NOT NULL,
  alt TEXT NOT NULL,                       -- required: no alt, no upload
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_media_org ON media(org_id);

CREATE TABLE ai_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  user_id TEXT,
  kind TEXT NOT NULL,                      -- site_starter | rewrite | meta
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ai_audit_org ON ai_audit(org_id);

ALTER TABLE orgs ADD COLUMN nav_json TEXT;      -- ordered [{label, href}]
ALTER TABLE orgs ADD COLUMN brand_json TEXT;    -- {accent, tagline}
ALTER TABLE orgs ADD COLUMN custom_domain TEXT; -- bare domain, no www
ALTER TABLE orgs ADD COLUMN domain_status TEXT; -- pending | active | manual
CREATE UNIQUE INDEX idx_orgs_domain ON orgs(custom_domain) WHERE custom_domain IS NOT NULL;
