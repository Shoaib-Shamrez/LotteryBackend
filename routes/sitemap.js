import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sitemapPath = path.join(__dirname, "../public/sitemap.xml");

// GET sitemap - endpoint for frontend to fetch from different server
router.get("/", (req, res) => {
  try {
    if (!fs.existsSync(sitemapPath)) {
      return res.status(404).json({
        success: false,
        message: "Sitemap not found",
      });
    }

    const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");
    res.type("application/xml").send(sitemapContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// POST to regenerate/sync sitemap (admin endpoint)
router.post("/regenerate", async (req, res) => {
  try {
    if (!fs.existsSync(sitemapPath)) {
      return res.status(404).json({
        success: false,
        message: "Sitemap file not found",
      });
    }

    const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");
    const urlCount = (sitemapContent.match(/<url>/g) || []).length;

    res.json({
      success: true,
      message: "Sitemap validated and ready to serve",
      urlCount: urlCount,
      timestamp: new Date().toISOString(),
      endpoint: "/sitemap", // Frontend accesses sitemap at this URL
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
