-- Via Tutela — initial schema
-- Multi-tenant core + free migration importer (staging + jobs).

-- ============ Core tenancy ============

CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- ============ Animals & friends ============

CREATE TABLE animals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  source_key TEXT,                -- id from the system they migrated from
  name TEXT NOT NULL,
  species TEXT,
  breed TEXT,
  sex TEXT,
  dob TEXT,
  altered INTEGER,                -- 0/1, null = unknown
  microchip TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  description TEXT,
  bonded_group_id TEXT,           -- animals sharing a group id must go home together
  intake_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_animals_org ON animals(org_id);
CREATE INDEX idx_animals_org_source ON animals(org_id, source_key);
CREATE INDEX idx_animals_microchip ON animals(microchip);

CREATE TABLE animal_photos (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  animal_id TEXT NOT NULL REFERENCES animals(id),
  r2_key TEXT NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_photos_animal ON animal_photos(animal_id);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  source_key TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  roles TEXT,                     -- comma list: adopter,foster,volunteer,donor
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_contacts_org ON contacts(org_id);
CREATE INDEX idx_contacts_org_source ON contacts(org_id, source_key);

CREATE TABLE medical_records (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  animal_id TEXT NOT NULL REFERENCES animals(id),
  source_key TEXT,
  date TEXT,
  type TEXT,                      -- vaccine, exam, surgery, treatment, note
  description TEXT,
  vet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_medical_animal ON medical_records(animal_id);

CREATE TABLE adoptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  animal_id TEXT NOT NULL REFERENCES animals(id),
  contact_id TEXT REFERENCES contacts(id),
  source_key TEXT,
  date TEXT,
  fee REAL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_adoptions_animal ON adoptions(animal_id);
CREATE INDEX idx_adoptions_org ON adoptions(org_id);

-- ============ Importer: jobs & files ============

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL,    -- anonymous browser session that owns this job
  org_id TEXT REFERENCES orgs(id),-- set once the import is claimed by a new org
  status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded|mapping|processing|done|failed|claimed
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_ok INTEGER NOT NULL DEFAULT 0,
  rows_flagged INTEGER NOT NULL DEFAULT 0,
  photos_ok INTEGER NOT NULL DEFAULT 0,
  photos_failed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jobs_session ON import_jobs(session_token);

CREATE TABLE import_files (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  kind TEXT NOT NULL DEFAULT 'auto', -- animals|contacts|medical|adoptions|auto
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  format TEXT NOT NULL,           -- csv|xlsx
  headers_json TEXT,              -- detected header row
  mapping_json TEXT,              -- confirmed column mapping
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_files_job ON import_files(job_id);

CREATE TABLE import_row_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  file_id TEXT NOT NULL REFERENCES import_files(id),
  row_num INTEGER NOT NULL,
  field TEXT,
  reason TEXT NOT NULL,
  raw_json TEXT
);
CREATE INDEX idx_row_errors_job ON import_row_errors(job_id);

-- ============ Importer: staging (promoted to real tables on signup) ============

CREATE TABLE staging_animals (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  row_num INTEGER,
  source_key TEXT,
  name TEXT NOT NULL,
  species TEXT,
  breed TEXT,
  sex TEXT,
  dob TEXT,
  altered INTEGER,
  microchip TEXT,
  status TEXT,
  description TEXT,
  bonded_with TEXT,               -- raw reference to bonded companion (resolved on promote)
  bonded_group_id TEXT,
  intake_date TEXT,
  photo_urls TEXT                 -- JSON array of source photo URLs
);
CREATE INDEX idx_stg_animals_job ON staging_animals(job_id);
CREATE INDEX idx_stg_animals_source ON staging_animals(job_id, source_key);

CREATE TABLE staging_contacts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  row_num INTEGER,
  source_key TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  roles TEXT
);
CREATE INDEX idx_stg_contacts_job ON staging_contacts(job_id);
CREATE INDEX idx_stg_contacts_source ON staging_contacts(job_id, source_key);

CREATE TABLE staging_medical (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  row_num INTEGER,
  source_key TEXT,
  animal_ref TEXT,                -- raw animal reference from the file
  staging_animal_id TEXT,         -- resolved link
  date TEXT,
  type TEXT,
  description TEXT,
  vet TEXT
);
CREATE INDEX idx_stg_medical_job ON staging_medical(job_id);

CREATE TABLE staging_adoptions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  row_num INTEGER,
  source_key TEXT,
  animal_ref TEXT,
  staging_animal_id TEXT,
  contact_ref TEXT,
  staging_contact_id TEXT,
  date TEXT,
  fee REAL,
  status TEXT
);
CREATE INDEX idx_stg_adoptions_job ON staging_adoptions(job_id);

CREATE TABLE staging_photos (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  staging_animal_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  source_url TEXT
);
CREATE INDEX idx_stg_photos_job ON staging_photos(job_id);
