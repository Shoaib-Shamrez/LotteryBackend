// routes/siteRoutes.js
import express from "express";
import SiteController from "../controllers/siteController.js";

const router = express.Router();

// Get SEO Settings
router.get("/seo-settings", SiteController.getSeoSettings);

// Update SEO Settings
router.put("/seo-settings", SiteController.updateSeoSettings);

// Create SEO Settings (initial setup)
router.post("/seo-settings", SiteController.createSeoSettings);

export default router;
