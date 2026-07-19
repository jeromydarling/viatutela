-- Supercharged adoption pages: video support + application intent.

ALTER TABLE animal_photos ADD COLUMN kind TEXT NOT NULL DEFAULT 'photo'; -- photo | video
ALTER TABLE animal_photos ADD COLUMN caption TEXT;
ALTER TABLE applications ADD COLUMN interest TEXT; -- adopt | meet | foster_to_adopt | question
