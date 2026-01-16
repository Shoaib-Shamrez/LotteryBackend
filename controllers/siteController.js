// controllers/siteController.js
import SiteModel from "../models/siteSeo.js";

class SiteController {
  // Get SEO Settings
  static async getSeoSettings(req, res) {
    try {
      const settings = await SiteModel.getSeoSettings();

      if (!settings) {
        return res.status(404).json({
          success: false,
          message: "SEO settings not found",
        });
      }

      // Transform database column names to camelCase for frontend
      const formattedSettings = {
        siteTitle: settings.site_title,
        siteDescription: settings.site_description,
        siteKeywords: settings.site_keywords,
        siteLogo: settings.site_logo,
        siteIcon: settings.site_icon,
        canonicalUrl: settings.canonical_url,
        ogTitle: settings.og_title,
        ogDescription: settings.og_description,
        ogImage: settings.og_image,
        twitterCard: settings.twitter_card,
        twitterSite: settings.twitter_site,
      };

      res.status(200).json({
        success: true,
        data: formattedSettings,
      });
    } catch (error) {
      console.error("Error fetching SEO settings:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching SEO settings",
        error: error.message,
      });
    }
  }

  // Update SEO Settings
  static async updateSeoSettings(req, res) {
    try {
      const {
        siteTitle,
        siteDescription,
        siteKeywords,
        siteIcon,
        siteLogo,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        twitterCard,
        twitterSite,
      } = req.body;

      // Validate required fields
      if (!siteTitle || !siteDescription || !canonicalUrl) {
        return res.status(400).json({
          success: false,
          message: "Site title, description, and canonical URL are required",
        });
      }

      // Convert camelCase to snake_case for database
      const settingsData = {
        site_title: siteTitle,
        site_description: siteDescription,
        site_keywords: siteKeywords,
        site_icon: siteIcon,
        site_logo: siteLogo,
        canonical_url: canonicalUrl,
        og_title: ogTitle,
        og_description: ogDescription,
        og_image: ogImage,
        twitter_card: twitterCard,
        twitter_site: twitterSite,
      };

      const result = await SiteModel.updateSeoSettings(settingsData);

      res.status(200).json({
        success: true,
        message: "SEO settings updated successfully",
        data: {
          siteTitle,
          siteDescription,
          siteKeywords,
          siteLogo,
          siteIcon,
          canonicalUrl,
          ogTitle,
          ogDescription,
          ogImage,
          twitterCard,
          twitterSite,
        },
      });
    } catch (error) {
      console.error("Error updating SEO settings:", error);
      res.status(500).json({
        success: false,
        message: "Error updating SEO settings",
        error: error.message,
      });
    }
  }

  // Create SEO Settings (initial setup)
  static async createSeoSettings(req, res) {
    try {
      const {
        siteTitle,
        siteDescription,
        siteKeywords,
        siteLogo,
        siteIcon,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        twitterCard,
        twitterSite,
      } = req.body;

      if (!siteTitle || !siteDescription || !canonicalUrl) {
        return res.status(400).json({
          success: false,
          message: "Site title, description, and canonical URL are required",
        });
      }

      const settingsData = {
        site_title: siteTitle,
        site_description: siteDescription,
        site_keywords: siteKeywords,
        site_logo: siteLogo,
        site_Icon: siteIcon,
        canonical_url: canonicalUrl,
        og_title: ogTitle,
        og_description: ogDescription,
        og_image: ogImage,
        twitter_card: twitterCard,
        twitter_site: twitterSite,
      };

      const result = await SiteModel.createSeoSettings(settingsData);

      res.status(201).json({
        success: true,
        message: "SEO settings created successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error creating SEO settings:", error);
      res.status(500).json({
        success: false,
        message: "Error creating SEO settings",
        error: error.message,
      });
    }
  }
}

export default SiteController;
