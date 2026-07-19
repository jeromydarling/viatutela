-- Via Tutela v2 — auth, adoption applications, fosters, donations,
-- campaigns, tasks, richer org + animal fields.

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;

ALTER TABLE orgs ADD COLUMN about TEXT;
ALTER TABLE orgs ADD COLUMN website TEXT;
ALTER TABLE orgs ADD COLUMN email TEXT;
ALTER TABLE orgs ADD COLUMN phone TEXT;
ALTER TABLE orgs ADD COLUMN address TEXT;

ALTER TABLE animals ADD COLUMN kennel TEXT;
ALTER TABLE animals ADD COLUMN color TEXT;
ALTER TABLE animals ADD COLUMN weight TEXT;
ALTER TABLE animals ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  animal_id TEXT REFERENCES animals(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  home_type TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new|approved|denied|withdrawn
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE INDEX idx_applications_org ON applications(org_id, status);

CREATE TABLE foster_assignments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  animal_id TEXT NOT NULL REFERENCES animals(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fosters_org ON foster_assignments(org_id, active);
CREATE INDEX idx_fosters_animal ON foster_assignments(animal_id);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  goal REAL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_campaigns_org ON campaigns(org_id);

CREATE TABLE donations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  contact_id TEXT REFERENCES contacts(id),
  campaign_id TEXT REFERENCES campaigns(id),
  donor_name TEXT,
  email TEXT,
  amount REAL NOT NULL,
  method TEXT,             -- cash|check|card|online|other (Stripe later)
  note TEXT,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_donations_org ON donations(org_id, date);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  title TEXT NOT NULL,
  due_date TEXT,
  animal_id TEXT REFERENCES animals(id),
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tasks_org ON tasks(org_id, done);
