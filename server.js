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
import prizeBreakdown from "./routes/prizeBreakRoute.js";
import { testEmailConfig } from "./utils/emailService.js";
import Jackpotroutes from "./routes/jackpotRoutes.js";
import siteRoutes from "./routes/siteRoutes.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.set("trust proxy", true);

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

// ============================================
// NEW: Sitemap route (serves sitemap.xml)
// ============================================
app.get("/sitemap.xml", (req, res) => {
  const sitemapPath = path.join(__dirname, "public", "sitemap.xml");
  res.sendFile(sitemapPath, (err) => {
    if (err) {
      console.error("Error serving sitemap:", err);
      res.status(404).send("Sitemap not found");
    }
  });
});

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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
