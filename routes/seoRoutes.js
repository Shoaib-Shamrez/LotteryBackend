import express from "express";
// import fs from fs;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  getAllSEO,
  getSEOByPage,
  updateSEO,
} from "../controllers/seoController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { bustSitemapCache, getDynamicSitemap } from "../utils/sitemapService.js";

router.post("/sync-sitemap", async (req, res) => {
  try {
    bustSitemapCache();
    const { xml, count } = await getDynamicSitemap({ baseUrl: process.env.APP_URL }).catch(() => ({ xml: "", count: 0 }));

    // Optional copy to local public directory if present
    const backendSitemapPath = path.join(__dirname, "../public/sitemap.xml");
    if (xml && fs.existsSync(path.dirname(backendSitemapPath))) {
      try {
        fs.writeFileSync(backendSitemapPath, xml, "utf-8");
      } catch (err) {
        console.warn("Could not sync sitemap to backend public dir:", err.message);
      }
    }

    const frontendSitemapPath = path.join(__dirname, "../../LotteryResults/public/sitemap.xml");
    if (xml && fs.existsSync(path.dirname(frontendSitemapPath))) {
      try {
        fs.writeFileSync(frontendSitemapPath, xml, "utf-8");
      } catch (err) {
        console.warn("Could not sync sitemap to frontend public dir:", err.message);
      }
    }

    res.json({
      success: true,
      message: "Dynamic sitemap cache cleared and synchronized",
      urlCount: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/", getAllSEO);
router.get("/:page", getSEOByPage);
router.put("/:page", updateSEO);

export default router;
