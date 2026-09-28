CREATE TABLE IF NOT EXISTS match_change_notices (
  id serial PRIMARY KEY,
  match_id integer NOT NULL,
  kind text NOT NULL,
  team_id integer NOT NULL,
  opponent text NOT NULL,
  previous_kickoff_at timestamp NOT NULL,
  kickoff_at timestamp NOT NULL,
  venue text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_change_notices_match_id_idx ON match_change_notices (match_id, id);