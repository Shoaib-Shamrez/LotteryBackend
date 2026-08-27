// LotteryBackend/routes/syncRoutes.js
import express from "express";
import { syncAuthMiddleware } from "../middleware/syncAuth.js";
import { IngestionSyncEngine } from "../utils/ingestion/sync.js";
import { getSyncLogs, getSyncLogById } from "../models/syncLogModel.js";

const router = express.Router();
const engine = new IngestionSyncEngine();

// Allowed categories for ingestion
const ALLOWED_CATEGORIES = [
  "numbers",
  "win4",
  "take5",
  "lotto",
  "powerball",
  "megamillions"
];

// Helper to validate date string (YYYY-MM-DD) and ensure it's a real date
function isValidDate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr + "T00:00:00.000");
  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
}

router.post("/trigger", syncAuthMiddleware, async (req, res) => {
  const startTime = Date.now();
  const { category, date, dryRun } = req.query;

  // --- Input validation ---
  if (!category) {
    return res.status(400).json({ success: false, error: "Query parameter 'category' is required." });
  }

  if (!ALLOWED_CATEGORIES.includes(category.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: `Unsupported category '${category}'. Allowed categories: ${ALLOWED_CATEGORIES.join(", ")}.`
    });
  }

  if (date !== undefined && date !== null && date !== "") {
    if (!isValidDate(date)) {
      return res.status(400).json({ success: false, error: `Invalid date format '${date}'. Expected YYYY-MM-DD.` });
    }
  }

  if (dryRun !== undefined && dryRun !== null && dryRun !== "") {
    if (dryRun !== "true" && dryRun !== "false") {
      return res.status(400).json({ success: false, error: "Query parameter 'dryRun' must be 'true' or 'false' if provided." });
    }
  }

  const isDryRun = dryRun === "true";

  try {
    const report = await engine.sync(category, date, isDryRun);
    if (!report.success) {
      return res.status(500).json(report);
    }
    return res.status(200).json(report);
  } catch (err) {
    console.error("[Sync Router] Unexpected execution error:", err);
    const report = {
      success: false,
      error: "An unexpected error occurred during sync execution.",
      details: err.message,
      durationMs: Date.now() - startTime
    };
    return res.status(500).json(report);
  }
});

// GET all sync logs with pagination
router.get('/logs', syncAuthMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const logs = await getSyncLogs({ limit, offset });
    return res.status(200).json(logs);
  } catch (err) {
    console.error('[Sync Router] Error fetching logs:', err);
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET single sync log by id
router.get('/logs/:id', syncAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const log = await getSyncLogById(id);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    return res.status(200).json(log);
  } catch (err) {
    console.error('[Sync Router] Error fetching log:', err);
    return res.status(500).json({ error: 'Failed to fetch log' });
  }
});

export default router;
