CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes','no','maybe')),
  responded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_event_player_uniq ON event_rsvps (event_id, player_id);
CREATE INDEX IF NOT EXISTS event_rsvps_event_idx ON event_rsvps (event_id);
