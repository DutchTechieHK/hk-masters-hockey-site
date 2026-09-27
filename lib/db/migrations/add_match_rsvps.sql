-- Compatibility DDL for environments applying SQL migrations directly.
-- Normal development and production schema changes come from the Drizzle schema.
CREATE TABLE IF NOT EXISTS match_rsvps (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  responded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT match_rsvps_status_check CHECK (status IN ('yes', 'no', 'maybe'))
);
CREATE UNIQUE INDEX IF NOT EXISTS match_rsvps_match_player_uniq ON match_rsvps(match_id, player_id);
CREATE INDEX IF NOT EXISTS match_rsvps_match_idx ON match_rsvps(match_id);