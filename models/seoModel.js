import db from "../config/db.js";

export const getAllMeta = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM seo_metadata", (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

export const getMetaByPage = (page) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM seo_metadata WHERE page_name = ?",
      [page],
      (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      }
    );
  });
};

export const updateMeta = (page, title, description) => {
  return new Promise((resolve, reject) => {
    db.query(
      "UPDATE seo_metadata SET meta_title = ?, meta_description = ? WHERE page_name = ?",
      [title, description, page],
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
};
