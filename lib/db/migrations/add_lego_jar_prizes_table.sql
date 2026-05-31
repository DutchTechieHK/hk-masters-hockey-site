-- LEGO Jar Prizes table

CREATE TABLE IF NOT EXISTS lego_jar_prizes (
  id SERIAL PRIMARY KEY,
  rank INTEGER NOT NULL UNIQUE,
  badge TEXT NOT NULL,
  badge_color TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  image_alt TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
