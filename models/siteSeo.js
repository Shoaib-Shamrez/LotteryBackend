// models/siteModel.js
import db from "../config/db.js";

class SiteModel {
  // Get all SEO settings
  static getSeoSettings() {
    return new Promise((resolve, reject) => {
      const query = "SELECT * FROM seo_settings WHERE id = 1";
      db.query(query, (error, results) => {
        if (error) {
          reject(new Error(`Database error: ${error.message}`));
        } else {
          resolve(results[0] || null);
        }
      });
    });
  }

  // Update SEO settings
  static updateSeoSettings(settingsData) {
    return new Promise((resolve, reject) => {
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
          site_title = ?,
          site_description = ?,
          site_keywords = ?,
          site_logo = ?,
          site_icon = ?,
          canonical_url = ?,
          og_title = ?,
          og_description = ?,
          og_image = ?,
          twitter_card = ?,
          twitter_site = ?,
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

      db.query(query, values, (error, results) => {
        if (error) {
          reject(new Error(`Database error: ${error.message}`));
        } else {
          resolve({
            success: true,
            message: "SEO settings updated successfully",
            data: settingsData,
          });
        }
      });
    });
  }

  // Create SEO settings (if not exists)
  static createSeoSettings(settingsData) {
    return new Promise((resolve, reject) => {
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      db.query(query, values, (error, results) => {
        if (error) {
          reject(new Error(`Database error: ${error.message}`));
        } else {
          resolve({
            success: true,
            message: "SEO settings created successfully",
            id: results.insertId,
          });
        }
      });
    });
  }
}

export default SiteModel;
