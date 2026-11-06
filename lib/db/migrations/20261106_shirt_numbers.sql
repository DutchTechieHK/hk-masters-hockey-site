-- Additive only. No attribution of mutable legacy values and no archive writes.
ALTER TABLE players ADD COLUMN IF NOT EXISTS shirt_number_revision integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS shirt_number_legacy_resolved boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS shirt_contexts (
  id serial PRIMARY KEY, name text NOT NULL, kind text NOT NULL,
  season_id integer REFERENCES seasons(id), season_name text,
  CONSTRAINT shirt_context_kind CHECK (kind IN ('league','tournament'))
);
CREATE UNIQUE INDEX IF NOT EXISTS shirt_context_season_kind ON shirt_contexts(season_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS shirt_context_name_kind ON shirt_contexts(name, kind);
CREATE TABLE IF NOT EXISTS shirt_assignments (
  id serial PRIMARY KEY, player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  context_id integer NOT NULL REFERENCES shirt_contexts(id), team_id integer NOT NULL REFERENCES teams(id),
  team_name text NOT NULL, number integer NOT NULL, status text NOT NULL,
  starts_on text, ends_on text, notes text, recorded_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT shirt_assignment_number CHECK (number BETWEEN 1 AND 99),
  CONSTRAINT shirt_assignment_status CHECK (status IN ('current','historical','void')),
  CONSTRAINT shirt_assignment_dates CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT shirt_current_no_end CHECK (status <> 'current' OR ends_on IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS shirt_assignment_one_current ON shirt_assignments(player_id, context_id, team_id) WHERE status = 'current';
CREATE TABLE IF NOT EXISTS shirt_audit (
  id serial PRIMARY KEY, player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  actor text NOT NULL, action text NOT NULL, reason text, detail text NOT NULL,
  before jsonb, after jsonb, recorded_at timestamp NOT NULL DEFAULT now()
);
