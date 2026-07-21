-- Self-service password reset: single-use, expiring tokens.
-- The token itself is never stored — only its SHA-256 hash — so a
-- database leak can't be replayed into an account takeover.

CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_password_resets_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);
