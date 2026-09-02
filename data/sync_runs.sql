/*
  Migration: sync_runs.sql
  Create table to track sync execution runs (manual / scheduled / retry / override).
  Run manually with: psql -f data/sync_runs.sql
*/

CREATE TABLE IF NOT EXISTS sync_runs (
  id              SERIAL PRIMARY KEY,
  start_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time        TIMESTAMPTZ,
  category        TEXT NOT NULL,
  start_date      DATE,
  end_date        DATE,
  dry_run         BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_by    TEXT NOT NULL CHECK (triggered_by IN ('manual','scheduled','retry','override')),
  success         BOOLEAN,
  message         TEXT,
  details         JSONB,
  errors          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_start_time   ON sync_runs (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_category     ON sync_runs (category, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_triggered_by ON sync_runs (triggered_by, start_time DESC);