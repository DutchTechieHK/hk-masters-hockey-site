ALTER TABLE fun_run_income DROP CONSTRAINT IF EXISTS fun_run_income_category_check;
ALTER TABLE fun_run_income ADD CONSTRAINT fun_run_income_category_check
  CHECK (category IN ('entry_fee', 'pledge', 'drinks_cookies'));
