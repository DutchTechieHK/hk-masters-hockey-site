-- Track which players have collected their kit items after delivery
CREATE TABLE IF NOT EXISTS kit_distributions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  collected_at TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, item_type)
);
