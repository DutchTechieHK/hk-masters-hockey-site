-- Adds the documents table for the admin document repository.
-- Managers can upload PDFs (mandatory forms, regulations, information documents)
-- and retrieve them from the admin portal.

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('mandatory-form', 'regulation', 'information')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by_email TEXT,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_category_idx
  ON documents(category);
