import express from "express";
import { syncAuthMiddleware } from "../middleware/syncAuth.js";
import { IngestionSyncEngine } from "../utils/ingestion/sync.js";

const router = express.Router();
const engine = new IngestionSyncEngine();

router.post("/trigger", syncAuthMiddleware, async (req, res) => {
  const { category, date, dryRun } = req.query;

  if (!category) {
    return res.status(400).json({
      success: false,
      error: "Query parameter 'category' is required."
    });
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
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred during sync execution.",
      details: err.message
    });
  }
});

export default router;
