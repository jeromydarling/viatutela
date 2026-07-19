-- Via Tutela v13 — photo studio: non-destructive AI enhancement + alt text
-- r2_key always points at what the world sees; original_key holds the
-- untouched upload whenever an enhanced version is live (revert = swap back).
ALTER TABLE animal_photos ADD COLUMN original_key TEXT;
ALTER TABLE animal_photos ADD COLUMN enhance_json TEXT;
ALTER TABLE animal_photos ADD COLUMN alt_text TEXT;
ALTER TABLE animal_photos ADD COLUMN ai_photo_json TEXT;
