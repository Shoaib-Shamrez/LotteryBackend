// Controllers for /api/admin/sync/* operator endpoints.
//
// Lifecycle for any sync execution is owned by the controller layer here:
//   1. createSyncRun(...)            -> returns runId
//   2. for each (category, date):    -> engine.syncSingle(...) which writes sync_logs
//   3. updateSyncRun(runId, ...)     -> finalizes the run with status/errors/details
//
// The sync engine MUST NOT create sync_runs rows; controllers MUST NOT write
// sync_logs rows directly.

import { IngestionSyncEngine } from "../utils/ingestion/sync.js";
import { IngestionValidator } from "../utils/ingestion/validator.js";
import {
  createSyncRun,
  updateSyncRun,
  getSyncRunById,
  listSyncRuns
} from "../models/syncRunModel.js";
import { getSyncLogsByRunId } from "../models/syncLogModel.js";
import { getPostById, updatePost } from "../models/postModel.js";

const ALLOWED_CATEGORIES = [
  "numbers",
  "win4",
  "take5",
  "lotto",
  "powerball",
  "megamillions"
];

const engine = new IngestionSyncEngine();
const validator = new IngestionValidator();

function isValidYmd(s) {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // Accept the literal string as a valid calendar date by re-parsing Y/M/D
  // without timezone dependency (avoids local-DST off-by-one on Windows).
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isoDateRange(startDate, endDate) {
  const out = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Internal executor for a created run.
 * Takes the plan (list of dates) and runs engine.syncSingle for each, linking logs.
 * Finalizes the run with aggregated status.
 */
async function executeRun({ runId, category, dates, dryRun }) {
  const perDate = [];
  const aggregatedErrors = [];
  let allSuccess = true;

  for (const date of dates) {
    let report;
    try {
      report = await engine.syncSingle(category, date, !!dryRun, runId);
    } catch (err) {
      aggregatedErrors.push(`[${date}] ${err.message}`);
      allSuccess = false;
      perDate.push({ date, logId: null, success: false, error: err.message });
      continue;
    }

    perDate.push({
      date,
      logId: report.logId ?? null,
      success: !!report.success,
      fetched: report.fetched,
      validated: report.validated,
      created: report.created,
      updated: report.updated,
      duplicates: report.duplicates,
      corrections: report.corrections,
      message: report.message ?? null
    });

    if (!report.success) {
      allSuccess = false;
    }
    if (Array.isArray(report.errors) && report.errors.length) {
      aggregatedErrors.push(...report.errors.map(e => `[${date}] ${e}`));
    }
  }

  const details = { perDate };
  const message = dates.length === 1
    ? `Manual execution for ${category} on ${dates[0]}${dryRun ? " (dry run)" : ""}`
    : `Manual execution for ${category} over ${dates[0]}..${dates[dates.length - 1]} (${dates.length} dates)${dryRun ? " (dry run)" : ""}`;

  await updateSyncRun(runId, {
    success: allSuccess,
    message,
    details,
    errors: aggregatedErrors
  });

  const finalRun = await getSyncRunById(runId);
  const logs = await getSyncLogsByRunId(runId);
  return { run: finalRun, logs };
}

// ---------- HTTP handlers ----------

/**
 * GET /api/admin/sync/runs
 * Query: category?, triggered_by?, success?, limit?, offset?
 */
export async function listRunsHandler(req, res) {
  const rawLimit = req.query.limit;
  const rawOffset = req.query.offset;
  const limit = rawLimit === undefined ? 100 : parseInt(rawLimit, 10);
  const offset = rawOffset === undefined ? 0 : parseInt(rawOffset, 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 200) {
    return res.status(400).json({ success: false, error: "Invalid 'limit'. Must be integer 1..200." });
  }
  if (!Number.isFinite(offset) || offset < 0) {
    return res.status(400).json({ success: false, error: "Invalid 'offset'. Must be >= 0." });
  }

  const filter = {
    limit,
    offset,
    category: req.query.category || undefined,
    triggered_by: req.query.triggered_by || undefined
  };
  if (req.query.success !== undefined) {
    if (req.query.success === "true") filter.success = true;
    else if (req.query.success === "false") filter.success = false;
    else return res.status(400).json({ success: false, error: "Invalid 'success'. Must be 'true' or 'false'." });
  }

  try {
    const runs = await listSyncRuns(filter);
    return res.status(200).json({ success: true, runs });
  } catch (err) {
    console.error("[AdminSync] listRuns error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/admin/sync/runs/:id
 */
export async function getRunHandler(req, res) {
  const run = await getSyncRunById(req.params.id);
  if (!run) return res.status(404).json({ success: false, error: "Run not found" });
  const logs = await getSyncLogsByRunId(run.id);
  return res.status(200).json({ success: true, run, logs });
}

/**
 * POST /api/admin/sync/runs
 * Body: { category, startDate?, endDate?, dryRun? }
 * If only startDate is provided, single-date run. Otherwise range (inclusive).
 */
export async function manualRunHandler(req, res) {
  const body = req.body || {};
  const { category, startDate, endDate, dryRun } = body;

  if (!category || typeof category !== "string") {
    return res.status(400).json({ success: false, error: "'category' is required." });
  }
  const cat = category.toLowerCase();
  if (!ALLOWED_CATEGORIES.includes(cat)) {
    return res.status(400).json({ success: false, error: `Unsupported category '${category}'.` });
  }

  let start, end;
  if (startDate === undefined && endDate === undefined) {
    const today = new Date().toISOString().slice(0, 10);
    start = today; end = today;
  } else {
    if (!isValidYmd(startDate)) {
      return res.status(400).json({ success: false, error: "Invalid 'startDate'. Expected YYYY-MM-DD." });
    }
    if (endDate === undefined || endDate === null || endDate === "") {
      end = startDate;
    } else {
      if (!isValidYmd(endDate)) {
        return res.status(400).json({ success: false, error: "Invalid 'endDate'. Expected YYYY-MM-DD." });
      }
      if (endDate < startDate) {
        return res.status(400).json({ success: false, error: "'endDate' must be >= 'startDate'." });
      }
      end = endDate;
    }
    start = startDate;
  }

  let runId;
  try {
    runId = await createSyncRun({
      category: cat,
      start_date: start,
      end_date: end,
      dry_run: !!dryRun,
      triggered_by: "manual"
    });
  } catch (err) {
    console.error("[AdminSync] createSyncRun error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }

  const dates = isoDateRange(start, end);
  const { run, logs } = await executeRun({ runId, category: cat, dates, dryRun: !!dryRun });

  return res.status(200).json({ success: true, runId, run, logs });
}

/**
 * POST /api/admin/sync/runs/:id/retry
 * Creates a NEW sync_run copying the original's params, executes it.
 */
export async function retryRunHandler(req, res) {
  const original = await getSyncRunById(req.params.id);
  if (!original) return res.status(404).json({ success: false, error: "Run not found" });

  const start = original.start_date
    ? new Date(original.start_date).toISOString().slice(0, 10)
    : null;
  const end = original.end_date
    ? new Date(original.end_date).toISOString().slice(0, 10)
    : start;

  let newRunId;
  try {
    newRunId = await createSyncRun({
      category: original.category,
      start_date: start,
      end_date: end,
      dry_run: original.dry_run,
      triggered_by: "retry"
    });
  } catch (err) {
    console.error("[AdminSync] createSyncRun(retry) error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }

  const dates = (start && end) ? isoDateRange(start, end) : [];
  const { run, logs } = await executeRun({
    runId: newRunId,
    category: original.category,
    dates,
    dryRun: original.dry_run
  });

  return res.status(200).json({
    success: true,
    originalRunId: original.id,
    runId: newRunId,
    run,
    logs
  });
}

/**
 * PATCH /api/admin/sync/draw/:postId/override
 * Body: { midday_winnings?: string[], evening_winnings?: string[] }
 *
 * Validates via IngestionValidator. Persists override using existing model.
 * Records an audit row in sync_runs (triggered_by='override'); errors=null.
 */
export async function overrideDrawHandler(req, res) {
  const { postId } = req.params;
  const body = req.body || {};
  const midday = body.midday_winnings;
  const evening = body.evening_winnings;

  if (
    (midday === undefined || midday === null) &&
    (evening === undefined || evening === null)
  ) {
    return res.status(400).json({
      success: false,
      error: "At least one of 'midday_winnings' or 'evening_winnings' must be provided."
    });
  }
  if (midday !== undefined && !Array.isArray(midday)) {
    return res.status(400).json({ success: false, error: "'midday_winnings' must be an array of strings." });
  }
  if (evening !== undefined && !Array.isArray(evening)) {
    return res.status(400).json({ success: false, error: "'evening_winnings' must be an array of strings." });
  }

  const post = await getPostById(postId);
  if (!post) return res.status(404).json({ success: false, error: "Post not found" });

  const drawDate = new Date(post.created_at).toISOString().slice(0, 10);

  const normalized = {
    category: post.category,
    drawDate,
    middayWinningNumbers: midday === undefined ? null : midday,
    eveningWinningNumbers: evening === undefined ? null : evening
  };
  const vresult = validator.validate(normalized);
  if (!vresult.isValid) {
    return res.status(400).json({ success: false, error: "Validation failed.", errors: vresult.errors });
  }

  const before = {
    midday_winnings: post.midday_winnings,
    evening_winnings: post.evening_winnings
  };
  const after = {
    midday_winnings: midday === undefined ? post.midday_winnings : midday,
    evening_winnings: evening === undefined ? post.evening_winnings : evening
  };

  try {
    await updatePost(post.id, {
      title: post.title,
      category: post.category,
      status: post.status,
      created_at: post.created_at,
      content: post.content,
      meta_title: post.meta_title,
      meta_desc: post.meta_desc,
      midday_winnings: after.midday_winnings,
      evening_winnings: after.evening_winnings
    });
  } catch (err) {
    console.error("[AdminSync] override updatePost error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }

  // Create audit run (no errors, errors field stays null)
  const runId = await createSyncRun({
    category: post.category,
    start_date: drawDate,
    end_date: drawDate,
    dry_run: false,
    triggered_by: "override"
  });
  const details = {
    postId: post.id,
    actor: "admin",
    before,
    after
  };
  await updateSyncRun(runId, {
    success: true,
    message: `Manual override applied to post #${post.id}`,
    details,
    errors: null
  });

  const run = await getSyncRunById(runId);
  return res.status(200).json({ success: true, postId: post.id, runId, run });
}