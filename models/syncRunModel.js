import pool from "../config/db.js";

/**
 * Insert a new sync_run row. Returns the new run id.
 *
 * @param {Object} params
 * @param {string} params.category
 * @param {string|null} [params.start_date]
 * @param {string|null} [params.end_date]
 * @param {boolean} [params.dry_run=false]
 * @param {'manual'|'scheduled'|'retry'|'override'} params.triggered_by
 * @returns {Promise<number>}
 */
export async function createSyncRun({ category, start_date = null, end_date = null, dry_run = false, triggered_by }) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO sync_runs
         (category, start_date, end_date, dry_run, triggered_by, start_time)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [category, start_date, end_date, !!dry_run, triggered_by]
    );
    return res.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Update a sync_run row with terminal state and any structured details.
 * Always also sets end_time = NOW().
 *
 * @param {number} runId
 * @param {Object} patch
 * @param {boolean} [patch.success]
 * @param {string} [patch.message]
 * @param {Object} [patch.details]
 * @param {Array}  [patch.errors]
 */
export async function updateSyncRun(runId, patch = {}) {
  const { success = null, message = null, details = null, errors = null } = patch;
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE sync_runs
       SET end_time = NOW(),
           success = $2,
           message = $3,
           details = $4,
           errors = $5
       WHERE id = $1`,
      [
        runId,
        success,
        message,
        details !== null ? JSON.stringify(details) : null,
        errors !== null && errors.length ? JSON.stringify(errors) : null
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Get a single sync_run row by id.
 */
export async function getSyncRunById(runId) {
  const numericId = Number(runId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM sync_runs WHERE id = $1`,
      [numericId]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * List sync_runs with optional filters + pagination.
 * Filters: { category?, triggered_by?, success?, limit?, offset? }
 */
export async function listSyncRuns(filter = {}) {
  const { category, triggered_by, success, limit = 100, offset = 0 } = filter;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (category) {
    conditions.push(`category = $${idx++}`);
    values.push(category);
  }
  if (triggered_by) {
    conditions.push(`triggered_by = $${idx++}`);
    values.push(triggered_by);
  }
  if (typeof success === "boolean") {
    conditions.push(`success = $${idx++}`);
    values.push(success);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM sync_runs ${whereClause}
       ORDER BY id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );
    return res.rows;
  } finally {
    client.release();
  }
}