-- Editable report date so match reports and news posts can be backdated.
-- When set, it controls both the displayed date and chronological ordering.
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS report_date timestamp;
ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS report_date timestamp;
