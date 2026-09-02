/*
  Migration: alter_sync_logs_add_run_id.sql
  Add nullable FK on sync_logs to link each log to its parent sync_run.
  ON DELETE SET NULL preserves logs when a run row is removed.
  Run manually with: psql -f data/alter_sync_logs_add_run_id.sql
*/

ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS run_id INTEGER
    REFERENCES sync_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sync_logs_run_id ON sync_logs (run_id);