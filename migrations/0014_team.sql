-- Via Tutela v14 — team invites: the "up to 2 staff seats" promise, kept.
-- A user row with an invite_token and no password is a pending invite;
-- claiming the link at /join/:token sets the password and clears it.
ALTER TABLE users ADD COLUMN invite_token TEXT;
ALTER TABLE users ADD COLUMN invited_by TEXT;
CREATE INDEX idx_users_invite ON users(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX idx_users_org ON users(org_id);
