CREATE TABLE IF NOT EXISTS event_rsvp_admin_changes (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  actor text NOT NULL,
  previous_status text,
  previous_note text,
  new_status text,
  new_note text,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_rsvp_admin_changes_event_idx ON event_rsvp_admin_changes(event_id);
