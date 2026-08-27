/*
  Migration: sync_logs.sql
  Create table to store sync execution logs.
  Run manually with: psql -f data/sync_logs.sql
*/
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  success BOOLEAN NOT NULL,
  category TEXT NOT NULL,
  sync_date DATE NOT NULL,
  fetched INTEGER,
  validated INTEGER,
  created_cnt INTEGER,
  updated_cnt INTEGER,
  duplicates_cnt INTEGER,
  corrections_cnt INTEGER,
  errors JSONB,
  duration_ms INTEGER,
  message TEXT
);
