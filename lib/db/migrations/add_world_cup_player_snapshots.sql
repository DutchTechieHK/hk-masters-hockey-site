-- Immutable campaign boundary. Applied through the normal publish/migration flow.
CREATE TABLE IF NOT EXISTS world_cup_player_snapshots (
  player_id integer PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  captured_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO world_cup_player_snapshots (player_id, snapshot)
SELECT id, to_jsonb(players.*)
FROM players
ON CONFLICT (player_id) DO NOTHING;