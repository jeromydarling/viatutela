-- Via Tutela v3 — multi-location + medical reminders

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  address TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_locations_org ON locations(org_id);

ALTER TABLE animals ADD COLUMN location_id TEXT REFERENCES locations(id);
CREATE INDEX idx_animals_location ON animals(location_id);

-- "next due" date for vaccines/treatments; cleared when handled
ALTER TABLE medical_records ADD COLUMN due_date TEXT;
CREATE INDEX idx_medical_due ON medical_records(org_id, due_date);
