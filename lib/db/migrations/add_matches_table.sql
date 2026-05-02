-- Migration: Create matches table for fixtures and results
-- Safe to run multiple times (idempotent)

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  opponent TEXT NOT NULL,
  kickoff_at TIMESTAMP NOT NULL,
  venue TEXT,
  our_score INTEGER,
  their_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Helpful indexes for common queries
CREATE INDEX IF NOT EXISTS matches_team_id_idx ON matches (team_id);
CREATE INDEX IF NOT EXISTS matches_kickoff_at_idx ON matches (kickoff_at);
