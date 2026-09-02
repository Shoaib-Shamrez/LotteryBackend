import pool from "../config/db.js";

/**
 * Inserts a sync execution report into the sync_logs table.
 * Optionally links the log to a sync_runs row.
 *
 * @param {Object} report  The report object returned by IngestionSyncEngine.
 * @param {number} [runId] Optional sync_runs.id to associate this log with.
 * @returns {Promise<number>} Inserted row id.
 */
export async function createSyncLog(report, runId = null) {
  const client = await pool.connect();
  try {
    const syncDate = report.date && report.date !== "latest"
      ? report.date
      : new Date().toISOString().split("T")[0];

    const res = await client.query(
      `INSERT INTO sync_logs
         (sync_date, category, success, duration_ms, errors, message, run_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        syncDate,
        report.category,
        report.success,
        report.durationMs || null,
        report.errors && report.errors.length
          ? JSON.stringify(report.errors)
          : null,
        report.message || null,
        runId
      ]
    );
    return res.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Retrieves sync logs with optional filters.
 * @param {Object} filter - {category?, date?, runId?, limit?, offset?}
 * @returns {Promise<Array<Object>>}
 */
export async function getSyncLogs(filter = {}) {
  const { category, date, runId, limit = 100, offset = 0 } = filter;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (category) {
    conditions.push(`category = $${idx++}`);
    values.push(category);
  }
  if (date) {
    conditions.push(`sync_date = $${idx++}`);
    values.push(date);
  }
  if (runId) {
    conditions.push(`run_id = $${idx++}`);
    values.push(runId);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM sync_logs ${whereClause}
       ORDER BY id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Retrieves all sync logs linked to a specific sync_run.
 * @param {number} runId
 * @returns {Promise<Array<Object>>}
 */
export async function getSyncLogsByRunId(runId) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM sync_logs WHERE run_id = $1 ORDER BY id ASC`,
      [runId]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Retrieves a single sync log by its id.
 * @param {number|string} id
 * @returns {Promise<Object|null>}
 */
export async function getSyncLogById(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM sync_logs WHERE id = $1`,
      [numericId]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}
