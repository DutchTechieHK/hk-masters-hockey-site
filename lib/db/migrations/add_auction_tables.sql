CREATE TABLE IF NOT EXISTS auction_settings (
  id SERIAL PRIMARY KEY,
  is_live BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  starting_price NUMERIC(10, 2) NOT NULL,
  min_increment NUMERIC(10, 2) NOT NULL DEFAULT 100,
  opens_at TIMESTAMP,
  closes_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction_bids (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES auction_items(id),
  bidder_name TEXT NOT NULL,
  bidder_email TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  placed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
