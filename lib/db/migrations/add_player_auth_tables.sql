CREATE TABLE IF NOT EXISTS player_login_codes (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_login_codes_email_idx ON player_login_codes (email);

CREATE TABLE IF NOT EXISTS player_sessions (
  token TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
