CREATE TABLE IF NOT EXISTS world_cup_team_snapshots (
  team_id integer PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  captured_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO world_cup_team_snapshots (team_id, snapshot)
SELECT DISTINCT t.id, to_jsonb(t.*)
FROM teams t
JOIN player_participations pp ON pp.team_id = t.id
JOIN seasons s ON s.id = pp.season_id
WHERE s.slug = 'rotterdam-2026' AND pp.participation_status = 'active'
ON CONFLICT (team_id) DO NOTHING;