-- Additive staff permissions. Apply through the normal Publish schema diff.
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS staff_team_grants (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id integer NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  role_label text NOT NULL DEFAULT 'Coach',
  manage_attendance boolean NOT NULL DEFAULT false,
  manage_schedule boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  revoked_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT staff_team_grants_version_positive CHECK (version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_team_grants_person_team_season
  ON staff_team_grants(player_id, team_id, season_id);
CREATE TABLE IF NOT EXISTS staff_sessions (
  token text PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staff_audit (
  id serial PRIMARY KEY,
  actor text NOT NULL,
  actor_player_id integer,
  team_id integer,
  action text NOT NULL,
  target text NOT NULL,
  status integer,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_audit_created_idx ON staff_audit(created_at);
