// Sync Log Model using pg pool
import pool from "../config/db.js";

/**
 * Inserts a sync execution report into the sync_logs table.
 * @param {Object} report - The report object returned by IngestionSyncEngine.
 * @returns {Promise<number>} - Inserted row id.
 */

// Creates a sync log entry and returns its id
export async function createSyncLog(report) {
  const client = await pool.connect();
  try {
    const syncDate = report.date && report.date !== 'latest'
      ? report.date
      : new Date().toISOString().split('T')[0];
    const res = await client.query(
      `INSERT INTO sync_logs (sync_date, category, success, duration_ms, errors)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        syncDate,
        report.category,
        report.success,
        report.durationMs || null,
        report.errors && report.errors.length ? JSON.stringify(report.errors) : null
      ]
    );
    return res.rows[0].id;
  } finally {
    client.release();
  }
}



/**
 * Retrieves sync logs with optional filters.
 * @param {Object} filter - {category?, date?}
 * @returns {Promise<Array<Object>>}
 */
export async function getSyncLogs(filter = {}) {
  const { category, date, limit = 100, offset = 0 } = filter;
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
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM sync_logs ${whereClause} ORDER BY id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Retrieves a single sync log by its id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getSyncLogById(id) {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT * FROM sync_logs WHERE id = $1`, [id]);
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}
