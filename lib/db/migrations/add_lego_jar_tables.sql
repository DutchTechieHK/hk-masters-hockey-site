-- LEGO Jar Challenge tables

CREATE TABLE IF NOT EXISTS lego_jar_config (
  id SERIAL PRIMARY KEY,
  price_per_guess NUMERIC(10,2) NOT NULL DEFAULT 50,
  actual_count INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  image_url TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed the single config row
INSERT INTO lego_jar_config (id, price_per_guess, status)
VALUES (1, 50, 'active')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS lego_jar_rounds (
  id SERIAL PRIMARY KEY,
  holder_name TEXT NOT NULL,
  squad_member_id INTEGER REFERENCES players(id),
  location TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lego_jar_guesses (
  id SERIAL PRIMARY KEY,
  round_id INTEGER REFERENCES lego_jar_rounds(id) ON DELETE CASCADE,
  guesser_name TEXT NOT NULL,
  guesser_email TEXT,
  guess_number INTEGER NOT NULL,
  payment_method TEXT,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
