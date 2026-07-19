-- Via Tutela — local development seed.
-- A tiny demo org so /app has something to show without running an import.

INSERT OR IGNORE INTO orgs (id, name, slug, plan) VALUES
  ('org_demo000000000000000000', 'Sunny Meadow Rescue (demo)', 'sunny-meadow-demo', 'free');

INSERT OR IGNORE INTO users (id, org_id, email, name) VALUES
  ('usr_demo000000000000000000', 'org_demo000000000000000000', 'demo@viatutela.local', 'Demo Human');

INSERT OR IGNORE INTO animals (id, org_id, source_key, name, species, breed, sex, dob, altered, status, bonded_group_id) VALUES
  ('an_demo0000000000000000001', 'org_demo000000000000000000', 'A-101', 'Biscuit', 'dog', 'Terrier mix', 'male', '2021-04-12', 1, 'available', NULL),
  ('an_demo0000000000000000002', 'org_demo000000000000000000', 'A-102', 'Waffle', 'dog', 'Terrier mix', 'female', '2021-04-12', 1, 'available', 'bg_demo00000000000000000001'),
  ('an_demo0000000000000000003', 'org_demo000000000000000000', 'A-103', 'Pancake', 'dog', 'Beagle', 'female', '2019-09-01', 1, 'available', 'bg_demo00000000000000000001'),
  ('an_demo0000000000000000004', 'org_demo000000000000000000', 'A-104', 'Mochi', 'cat', 'Domestic shorthair', 'female', '2023-01-20', 0, 'in foster', NULL);

INSERT OR IGNORE INTO contacts (id, org_id, source_key, name, email, roles) VALUES
  ('ct_demo0000000000000000001', 'org_demo000000000000000000', 'C-1', 'Clare Field', 'clare@example.org', 'foster'),
  ('ct_demo0000000000000000002', 'org_demo000000000000000000', 'C-2', 'Anthony Woods', 'anthony@example.org', 'adopter');

INSERT OR IGNORE INTO medical_records (id, org_id, animal_id, date, type, description, vet) VALUES
  ('md_demo0000000000000000001', 'org_demo000000000000000000', 'an_demo0000000000000000001', '2026-05-10', 'vaccine', 'DHPP booster', 'Dr. Rivo'),
  ('md_demo0000000000000000002', 'org_demo000000000000000000', 'an_demo0000000000000000004', '2026-06-02', 'exam', 'Intake exam — healthy', 'Dr. Rivo');
