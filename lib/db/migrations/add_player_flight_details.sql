-- Add outbound + return flight detail columns to players (idempotent)
ALTER TABLE players ADD COLUMN IF NOT EXISTS outbound_flight_number text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS outbound_departure_date_time text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS return_flight_number text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS return_arrival_date_time text;
