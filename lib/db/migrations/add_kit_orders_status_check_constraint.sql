-- Add CHECK constraint to kit_orders.order_status to enforce the 7 valid values
ALTER TABLE kit_orders
  ADD CONSTRAINT kit_orders_order_status_check
  CHECK (order_status IN ('not_ordered','artwork_pending','artwork_approved','ordered','in_production','dispatched','received'));
