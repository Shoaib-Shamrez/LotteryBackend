import express from "express";
const router = express.Router();
const fs = require("fs");
const path = require("path");

// Option A: Read from file
router.get("/sitemap", (req, res) => {
  const sitemapPath = path.join(__dirname, "../public/sitemap.xml");

  try {
    const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");
    res.type("application/xml").send(sitemapContent);
  } catch (error) {
    res.status(404).json({ error: "Sitemap not found" });
  }
});
