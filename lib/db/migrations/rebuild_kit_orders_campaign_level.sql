-- Drop old per-player kits table and replace with campaign-level kit_orders
DROP TABLE IF EXISTS kits;

CREATE TABLE kit_orders (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'playing_kit',
  supplier TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost_hkd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deposit_amount_hkd NUMERIC(10, 2),
  deposit_paid_date TEXT,
  balance_due_date TEXT,
  balance_paid_date TEXT,
  order_placed_date TEXT,
  artwork_approved_date TEXT,
  expected_delivery_date TEXT,
  actual_delivery_date TEXT,
  order_status TEXT NOT NULL DEFAULT 'not_ordered',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
