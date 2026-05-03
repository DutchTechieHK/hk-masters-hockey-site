-- Promote the existing players_access_token_unique index to a real UNIQUE
-- constraint so drizzle-kit push doesn't prompt to add it on every merge.
-- Idempotent: only runs if the constraint is missing but the index exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_access_token_unique'
      AND conrelid = 'players'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = 'players_access_token_unique'
        AND relkind = 'i'
    ) THEN
      ALTER TABLE players
        ADD CONSTRAINT players_access_token_unique
        UNIQUE USING INDEX players_access_token_unique;
    ELSE
      ALTER TABLE players
        ADD CONSTRAINT players_access_token_unique
        UNIQUE (access_token);
    END IF;
  END IF;
END $$;
