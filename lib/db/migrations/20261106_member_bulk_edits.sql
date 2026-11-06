CREATE TABLE IF NOT EXISTS member_bulk_edits (
  id serial PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  input_hash text NOT NULL,
  season_id integer NOT NULL REFERENCES seasons(id),
  season_name text NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  actor text NOT NULL,
  changed integer NOT NULL,
  unchanged integer NOT NULL,
  rows jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_bulk_edits_field_value CHECK (
    (field = 'section' AND value IN ('not_set', 'men', 'women')) OR
    (field = 'category' AND value IN ('awaiting_selection', 'trials', 'community_member', 'social_player', 'masters_division_one'))
  ),
  CONSTRAINT member_bulk_edits_counts CHECK (changed > 0 AND unchanged >= 0),
  CONSTRAINT member_bulk_edits_rows_array CHECK (jsonb_typeof(rows) = 'array')
);
CREATE INDEX IF NOT EXISTS member_bulk_edits_season_idx ON member_bulk_edits (season_id, id);
