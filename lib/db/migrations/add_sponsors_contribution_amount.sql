ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS contribution_amount NUMERIC(12, 2);
