import db from "../config/db.js";

export const getAllFaqs = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM faqs ORDER BY id DESC", (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

export const getFaqById = (id) => {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM faqs WHERE id = ?", [id], (err, results) => {
      if (err) reject(err);
      else resolve(results[0]);
    });
  });
};

export const createFaq = (question, answer) => {
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO faqs (question, answer) VALUES (?, ?)",
      [question, answer],
      (err, result) => {
        if (err) reject(err);
        else resolve({ id: result.insertId });
      }
    );
  });
};

export const deleteFaq = (id) => {
  return new Promise((resolve, reject) => {
    db.query("DELETE FROM faqs WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};
