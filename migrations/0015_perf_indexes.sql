-- Via Tutela v15 — indexes for the hottest remaining query shapes
-- animals filtered by org+status appear in dashboards, lists, public
-- pages, and feeds; sessions cleanup scans by expiry; member removal
-- deletes sessions by user.
CREATE INDEX idx_animals_org_status ON animals(org_id, status);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);
