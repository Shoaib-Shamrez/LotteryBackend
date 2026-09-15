// LotteryBackend/routes/scheduleSync.js
import express from "express";
import { runScheduledForCategory } from "../controllers/syncRunController.js";
import { loadSchedulerConfig } from "../utils/scheduler.js";

const router = express.Router();

/**
 * Middleware that validates Vercel Cron authorization header.
 * Official Vercel Cron jobs send: Authorization: Bearer <CRON_SECRET>
 */
function cronAuthMiddleware(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  
  if (cronSecret && authHeader && authHeader === `Bearer ${cronSecret}`) {
    return next();
  }
  
  return res.status(401).json({ error: "Unauthorized: Missing or invalid Cron authorization token" });
}

async function handleScheduleSync(req, res) {
  try {
    const category = req.query.category || req.body?.category;
    const date = req.query.date || req.body?.date;
    const reports = [];
    
    if (category) {
      const report = await runScheduledForCategory(category, date);
      reports.push(report);
    } else {
      const config = loadSchedulerConfig();
      const categories = config.categories || [];
      const dates = config.dates || [];
      for (const cat of categories) {
        for (const d of dates) {
          const report = await runScheduledForCategory(cat, d);
          reports.push(report);
        }
      }
    }
    return res.status(200).json({ success: true, reports });
  } catch (err) {
    console.error("[ScheduleSync] error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Official Vercel Cron uses GET /api/sync/schedule
 */
router.get("/", cronAuthMiddleware, handleScheduleSync);

/**
 * Backward compatibility: also support POST /api/sync/schedule
 */
router.post("/", cronAuthMiddleware, handleScheduleSync);

export default router;
