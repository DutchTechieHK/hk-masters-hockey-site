-- Add travel_note column to players (idempotent)
ALTER TABLE players ADD COLUMN IF NOT EXISTS travel_note text;
