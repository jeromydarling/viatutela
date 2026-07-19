-- New-org onboarding email drip (day 1 / 3 / 7), drained by the daily cron.
CREATE TABLE onboarding_emails (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL,
  name TEXT,
  kind TEXT NOT NULL, -- day1|day3|day7
  due_date TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX idx_onboarding_due ON onboarding_emails(due_date, sent_at);
