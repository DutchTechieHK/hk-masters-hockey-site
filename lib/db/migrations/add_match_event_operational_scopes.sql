-- Nullable by design for safety. Production inventory was explicitly reviewed:
-- all matches (2026-07-23..2026-07-31) are Rotterdam tournament matches;
-- events through 2026-08-07 are World Cup preparation/tour/closing/LEGO;
-- 2026-09-18 and 2026-09-25 are MASTERS TRIALS (local operations).
-- Therefore 2026-09-01 is the evidence-based campaign boundary. This
-- idempotent backfill only classifies currently NULL rows and never rewrites
-- an already reviewed scope.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS operational_scope text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS operational_scope text;
UPDATE matches
SET operational_scope = CASE
  WHEN kickoff_at < TIMESTAMP '2026-09-01' THEN 'world_cup_2026'
  ELSE 'local_2026_27'
END
WHERE operational_scope IS NULL;
UPDATE events
SET operational_scope = CASE
  WHEN starts_at < TIMESTAMP '2026-09-01' THEN 'world_cup_2026'
  ELSE 'local_2026_27'
END
WHERE operational_scope IS NULL;
CREATE INDEX IF NOT EXISTS matches_operational_scope_idx ON matches (operational_scope);
CREATE INDEX IF NOT EXISTS events_operational_scope_idx ON events (operational_scope);