// models/siteModel.js
import db from "../config/db.js";

class SiteModel {
  // Get all SEO settings
  static async getSeoSettings() {
    const { rows } = await db.query("SELECT * FROM seo_settings WHERE id = 1");
    return rows[0] || null;
  }

  // Update SEO settings
  static async updateSeoSettings(settingsData) {
    const {
      site_title,
      site_description,
      site_keywords,
      site_logo,
      site_icon,
      canonical_url,
      og_title,
      og_description,
      og_image,
      twitter_card,
      twitter_site,
    } = settingsData;

    const query = `
        UPDATE seo_settings 
        SET 
          site_title = $1,
          site_description = $2,
          site_keywords = $3,
          site_logo = $4,
          site_icon = $5,
          canonical_url = $6,
          og_title = $7,
          og_description = $8,
          og_image = $9,
          twitter_card = $10,
          twitter_site = $11,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `;

    const values = [
      site_title,
      site_description,
      site_keywords,
      site_logo,
      site_icon,
      canonical_url,
      og_title,
      og_description,
      og_image,
      twitter_card,
      twitter_site,
    ];

    await db.query(query, values);
    return {
      success: true,
      message: "SEO settings updated successfully",
      data: settingsData,
    };
  }

  // Create SEO settings (if not exists)
  static async createSeoSettings(settingsData) {
    const {
      site_title,
      site_description,
      site_keywords,
      site_logo,
      site_icon,
      canonical_url,
      og_title,
      og_description,
      og_image,
      twitter_card,
      twitter_site,
    } = settingsData;

    const query = `
        INSERT INTO seo_settings (
          site_title,
          site_description,
          site_keywords,
          site_logo,
          site_icon,
          canonical_url,
          og_title,
          og_description,
          og_image,
          twitter_card,
          twitter_site
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;

    const values = [
      site_title,
      site_description,
      site_keywords,
      site_logo,
      site_icon,
      canonical_url,
      og_title,
      og_description,
      og_image,
      twitter_card,
      twitter_site,
    ];

    const { rows } = await db.query(query, values);
    return {
      success: true,
      message: "SEO settings created successfully",
      id: rows[0].id,
    };
  }
}

export default SiteModel;
