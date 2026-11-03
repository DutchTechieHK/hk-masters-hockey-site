-- Additive only: existing event audiences remain squad-scoped.
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience_mode text NOT NULL DEFAULT 'squad';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_audience_check' AND conrelid = 'events'::regclass) THEN
    ALTER TABLE events ADD CONSTRAINT events_audience_check
      CHECK (audience_mode = 'squad' OR (audience_mode = 'groups' AND team_id IS NULL AND is_public = false));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS member_groups (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS member_group_members (
  group_id integer NOT NULL REFERENCES member_groups(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, player_id)
);
CREATE INDEX IF NOT EXISTS member_group_members_player_idx ON member_group_members(player_id);
CREATE TABLE IF NOT EXISTS event_groups (
  event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  group_id integer NOT NULL REFERENCES member_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (event_id, group_id)
);
CREATE INDEX IF NOT EXISTS event_groups_group_idx ON event_groups(group_id);
