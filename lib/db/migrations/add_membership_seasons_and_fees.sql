-- Establishes season-owned membership records and assigns historical payments
-- to the Rotterdam 2026 archive. Intentionally keeps season_id nullable for a
-- staged Publish rollout; enforce NOT NULL only after production verification.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS member_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_membership_tier TEXT NOT NULL DEFAULT 'awaiting_selection',
  ADD COLUMN IF NOT EXISTS membership_tier_updated_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  starts_on TEXT,
  ends_on TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO seasons (slug, name, kind, status, is_current, starts_on, ends_on)
VALUES
  ('rotterdam-2026', 'Rotterdam Masters World Cup 2026', 'event', 'archived', FALSE, '2026-08-01', '2026-08-31'),
  ('membership-2026-27', '2026/27 Membership', 'membership', 'current', TRUE, '2026-09-01', '2027-08-31')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  status = EXCLUDED.status,
  is_current = EXCLUDED.is_current,
  starts_on = EXCLUDED.starts_on,
  ends_on = EXCLUDED.ends_on,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS player_participations (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  team_id INTEGER REFERENCES teams(id),
  participation_status TEXT NOT NULL DEFAULT 'active',
  membership_tier TEXT,
  amount_due NUMERIC(10, 2),
  source TEXT NOT NULL DEFAULT 'admin',
  legacy_snapshot JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE player_participations
  ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10, 2);

CREATE UNIQUE INDEX IF NOT EXISTS player_participations_player_season_unique
  ON player_participations(player_id, season_id);
CREATE INDEX IF NOT EXISTS player_participations_player_idx
  ON player_participations(player_id);
CREATE INDEX IF NOT EXISTS player_participations_season_idx
  ON player_participations(season_id);

CREATE TABLE IF NOT EXISTS membership_interest_submissions (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  submitted_name TEXT NOT NULL,
  submitted_email TEXT NOT NULL,
  submitted_phone TEXT,
  membership_tier TEXT NOT NULL,
  matched_player_id INTEGER REFERENCES players(id),
  match_status TEXT NOT NULL DEFAULT 'pending',
  raw_data JSONB,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS membership_interest_submissions_season_idx
  ON membership_interest_submissions(season_id);
CREATE INDEX IF NOT EXISTS membership_interest_submissions_status_idx
  ON membership_interest_submissions(match_status);
CREATE INDEX IF NOT EXISTS membership_interest_submissions_email_idx
  ON membership_interest_submissions(submitted_email);

ALTER TABLE player_payments
  ADD COLUMN IF NOT EXISTS season_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'player_payments_season_id_seasons_id_fk'
  ) THEN
    ALTER TABLE player_payments
      ADD CONSTRAINT player_payments_season_id_seasons_id_fk
      FOREIGN KEY (season_id) REFERENCES seasons(id);
  END IF;
END $$;

UPDATE player_payments
SET season_id = (SELECT id FROM seasons WHERE slug = 'rotterdam-2026')
WHERE season_id IS NULL;

CREATE INDEX IF NOT EXISTS player_payments_season_idx
  ON player_payments(season_id);

INSERT INTO player_participations (
  player_id, season_id, participation_status, membership_tier, source
)
SELECT
  p.id,
  s.id,
  CASE WHEN p.member_status = 'active' THEN 'active' ELSE p.member_status END,
  p.current_membership_tier,
  'membership_backfill'
FROM players p
CROSS JOIN seasons s
WHERE s.slug = 'membership-2026-27'
ON CONFLICT (player_id, season_id) DO NOTHING;

INSERT INTO player_participations (
  player_id, season_id, team_id, participation_status, source, legacy_snapshot
)
SELECT
  p.id,
  s.id,
  p.team_id,
  'archived',
  'rotterdam_backfill',
  jsonb_build_object(
    'teamId', p.team_id,
    'feePaid', p.fee_paid,
    'paymentAmountDue', p.payment_amount_due,
    'paymentAmountPaid', p.payment_amount_paid,
    'paymentDate', p.payment_date
  )
FROM players p
CROSS JOIN seasons s
WHERE s.slug = 'rotterdam-2026'
  AND p.created_at < TIMESTAMP '2026-09-09 00:00:00'
ON CONFLICT (player_id, season_id) DO NOTHING;