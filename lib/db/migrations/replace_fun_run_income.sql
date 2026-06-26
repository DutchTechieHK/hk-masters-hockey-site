DROP TABLE IF EXISTS fun_run_participants;

CREATE TABLE IF NOT EXISTS fun_run_income (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  payer_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'entry_fee',
  amount_hkd NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
