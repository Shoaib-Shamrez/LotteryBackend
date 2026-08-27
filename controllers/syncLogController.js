// Sync Log Controller
import { getSyncLogs, getSyncLogById } from "../models/syncLogModel.js";

// POST /api/sync/log endpoint removed per architectural decision.

/**
 * GET /api/sync/logs
 * Optional query params: category, date
 */
export async function listSyncLogs(req, res) {
  try {
    const { limit = "100", offset = "0", category, date } = req.query;
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 200) {
      return res.status(400).json({ success: false, error: "Invalid 'limit' query param. Must be integer between 1 and 200." });
    }
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({ success: false, error: "Invalid 'offset' query param. Must be non‑negative integer." });
    }
    const logs = await getSyncLogs({ category, date, limit: limitNum, offset: offsetNum });
    res.status(200).json({ success: true, logs });
  } catch (err) {
    console.error("[SyncLogController] Error fetching logs:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/sync/logs/:id
 */
export async function getSyncLog(req, res) {
  try {
    const log = await getSyncLogById(parseInt(req.params.id, 10));
    if (!log) {
      return res.status(404).json({ success: false, error: "Log not found" });
    }
    res.status(200).json({ success: true, log });
  } catch (err) {
    console.error("[SyncLogController] Error fetching log:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
