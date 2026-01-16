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

router.post("/sync-sitemap", async (req, res) => {
  try {
    const backendSitemapPath = path.join(__dirname, "../public/sitemap.xml");

    if (!fs.existsSync(backendSitemapPath)) {
      return res.status(404).json({
        success: false,
        message: "Sitemap not found",
      });
    }

    const sitemapContent = fs.readFileSync(backendSitemapPath, "utf-8");
    const urlCount = (sitemapContent.match(/<url>/g) || []).length;

    // Copy to frontend
    const frontendSitemapPath = path.join(
      __dirname,
      "../../Lottery Frontend/public/sitemap.xml"
    );
    const frontendPublicDir = path.dirname(frontendSitemapPath);

    if (!fs.existsSync(frontendPublicDir)) {
      fs.mkdirSync(frontendPublicDir, { recursive: true });
    }

    fs.writeFileSync(frontendSitemapPath, sitemapContent, "utf-8");

    res.json({
      success: true,
      message: "Sitemap synced to frontend",
      urlCount: urlCount,
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
