-- Growth wave: waitlist alerts, post-adoption lifecycle, volunteer
-- scheduling, grant drafts, and the cross-shelter transfer network.

CREATE TABLE waitlist_subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL,
  name TEXT,
  species TEXT,                -- any|dog|cat|rabbit|small|other
  keywords TEXT,               -- free text: "senior", "bonded pair"…
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT
);
CREATE INDEX idx_waitlist_org ON waitlist_subscriptions(org_id);

CREATE TABLE followups (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  adoption_id TEXT NOT NULL REFERENCES adoptions(id),
  animal_id TEXT NOT NULL REFERENCES animals(id),
  email TEXT NOT NULL,
  adopter_name TEXT,
  animal_name TEXT,
  kind TEXT NOT NULL,          -- day3|week2|month6|gotcha_day
  due_date TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX idx_followups_due ON followups(due_date, sent_at);

CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  slots INTEGER NOT NULL DEFAULT 3,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_shifts_org ON shifts(org_id, date);

CREATE TABLE shift_signups (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  hours REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_signups_shift ON shift_signups(shift_id);
CREATE INDEX idx_signups_org ON shift_signups(org_id);

CREATE TABLE grant_drafts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  funder TEXT NOT NULL,
  amount TEXT,
  focus TEXT,
  content TEXT NOT NULL,       -- markdown
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_grants_org ON grant_drafts(org_id);

CREATE TABLE transfer_posts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  kind TEXT NOT NULL,          -- need_space|have_space
  species TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  urgency TEXT NOT NULL DEFAULT 'routine',  -- routine|soon|urgent
  note TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL DEFAULT (datetime('now','+14 days'))
);
CREATE INDEX idx_transfer_open ON transfer_posts(status, expires_at);
