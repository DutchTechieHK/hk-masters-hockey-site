CREATE TABLE IF NOT EXISTS player_payouts (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payout_date TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'fps',
  source TEXT NOT NULL DEFAULT 'fundraising',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
