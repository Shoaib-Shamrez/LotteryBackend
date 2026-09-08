// Add this to your server.js file

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route Imports (your existing imports)
import userRoutes from "./routes/userRoutes.js";
import faqsRoutes from "./routes/faqsRoutes.js";
import lotteryRoutes from "./routes/lotteryRoutes.js";
import pageRoutes from "./routes/pageRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import seoRoutes from "./routes/seoRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import winnerRoutes from "./routes/winnerRoutes.js";
import SitemapRoute from "./routes/sitemap.js";
import prizeBreakdown from "./routes/prizeBreakRoute.js";
import { testEmailConfig } from "./utils/emailService.js";
import Jackpotroutes from "./routes/jackpotRoutes.js";
import siteRoutes from "./routes/siteRoutes.js";

import syncRoutes from "./routes/syncRoutes.js";
import adminSyncRoutes from "./routes/adminSyncRoutes.js";
import { setSchedulerController } from "./utils/schedulerStatus.js";

dotenv.config();
const app = express();

// Middleware
const ALLOWED_ORIGINS = (
  process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / server-to-server
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);
app.use(express.json());
app.set("trust proxy", true);

// Robots.txt route - dynamic / static output pointing to sitemap.xml
app.get("/robots.txt", (req, res) => {
  const domain =
    process.env.BASE_URL ||
    process.env.APP_URL ||
    "https://nylotteryresults.com";
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${domain.replace(/\/$/, "")}/sitemap.xml\n`;
  res.type("text/plain").send(content);
});

// Sitemap route - dynamic, served from the database.
// MUST be registered BEFORE express.static so it intercepts /sitemap.xml
app.get("/sitemap.xml", async (req, res) => {
  try {
    const { getDynamicSitemap } = await import("./utils/sitemapService.js");
    const { xml } = await getDynamicSitemap({ baseUrl: process.env.APP_URL || process.env.BASE_URL || process.env.FRONTEND_URL });
    res.type("application/xml").send(xml);
  } catch (err) {
    console.error("Sitemap dynamic fetch failed:", err.message);
    res
      .status(500)
      .type("text/plain")
      .send(`Sitemap generation failed: ${err.message}`);
  }
});

// ============================================
// NEW: Serve static files (for sitemap)
// ============================================
app.use(express.static(path.join(__dirname, "public")));

// Routes (your existing routes)
app.use("/api/user", userRoutes);
app.use("/api/faqs", faqsRoutes);
app.use("/api/lotteries", lotteryRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/prize-breakdowns", prizeBreakdown);
app.use("/api/jackpot", Jackpotroutes);
app.use("/api/site", siteRoutes);

app.use("/api/seo", seoRoutes);
app.use("/api/subscriber", subscriptionRoutes);
app.use("/api/winners", winnerRoutes);
app.use("/api/sitemaps", SitemapRoute);
app.use("/api/sync", syncRoutes);
app.use("/api/admin/sync", adminSyncRoutes);

app.get("/api/test-email", async (req, res) => {
  const isValid = await testEmailConfig();
  res.json({ valid: isValid });
});

// Root Route
app.get("/", (req, res) => res.send("🎯 Lottery System Backend is running..."));
app.get("/ping", (req, res) => {
  res.status(200).json({ status: "ok", time: Date.now() });
});

//updated

// Server
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    console.log(`✅ Server running on port ${PORT}`);
    // Start the scheduler AFTER the HTTP server is up. Non-blocking: the
    // HTTP API stays available even if the scheduler never starts.
    try {
      const { startScheduler } = await import("./utils/scheduler.js");
      const { runScheduledForCategory } =
        await import("./controllers/syncRunController.js");
      const schedulerController = await startScheduler({
        runFor: runScheduledForCategory,
      });
      // Register the scheduler controller so health/scheduler-status
      // endpoints can query it via utils/schedulerStatus.js.
      // The scheduler itself is NOT duplicated, NOT re-created.
      setSchedulerController(schedulerController);
    } catch (err) {
      console.error("[Scheduler] failed to initialize:", err.message);
    }
  });
}

export default app;
export { app };
