ALTER TABLE players
  ADD COLUMN IF NOT EXISTS passport_copy_reviewed boolean NOT NULL DEFAULT false;
