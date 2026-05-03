-- Adds the player_payments ledger table and backfills existing
-- legacy paid amounts (players.payment_amount_paid / payment_date)
-- as a single 'Backfilled' entry so recomputed aggregates stay
-- lossless when subsequent payments are added or removed.

CREATE TABLE IF NOT EXISTS player_payments (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_payments_player_id
  ON player_payments(player_id);

-- One-time backfill: any player with a legacy paid amount but no
-- ledger row yet gets a single 'Backfilled' entry preserving the
-- amount and (best-effort) date.
INSERT INTO player_payments (player_id, amount, payment_date, method, notes)
SELECT
  p.id,
  p.payment_amount_paid::numeric,
  COALESCE(p.payment_date, ''),
  '',
  'Backfilled from legacy fee record'
FROM players p
LEFT JOIN player_payments pp ON pp.player_id = p.id
WHERE COALESCE(p.payment_amount_paid::numeric, 0) > 0
  AND pp.id IS NULL;
