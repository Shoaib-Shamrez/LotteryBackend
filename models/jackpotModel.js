import db from "../config/db.js";

export const getAllJackpots = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, Jackpot_category, amount, draw_date, color FROM jackpot ORDER BY draw_date DESC",
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getLatestJackpot = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, Jackpot_category, amount, draw_date, color FROM jackpot ORDER BY draw_date DESC LIMIT 1",
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getLatestJackpotByCategory = (category) => {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT id, Jackpot_category, amount, draw_date, color FROM jackpot WHERE Jackpot_category = ? ORDER BY draw_date DESC LIMIT 1`,
      [category],
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getJackpotById = (id) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, Jackpot_category, amount, draw_date, color FROM jackpot WHERE id = ?",
      [id],
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
// Create Jackpot
export const createJackpot = (data) => {
  const { Jackpot_category, amount, draw_date, color } = data;
  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO jackpot (Jackpot_category, amount, draw_date, color) VALUES (?, ?, ?, ?)`,
      [Jackpot_category, amount, draw_date, color],
      (err, results) => {
        if (err) reject(err);
        else resolve({ id: results.insertId, ...data });
      }
    );
  });
};

// Update Jackpot
export const updateJackpot = (id, data) => {
  const { Jackpot_category, amount, draw_date, color } = data;
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE jackpot SET Jackpot_category = ?, amount = ?, draw_date = ?, color = ? WHERE id = ?`,
      [Jackpot_category, amount, draw_date, color, id],
      (err, results) => {
        if (err) reject(err);
        else resolve({ id, ...data });
      }
    );
  });
};

// Delete Jackpot
export const deleteJackpot = (id) => {
  return new Promise((resolve, reject) => {
    db.query(`DELETE FROM jackpot WHERE id = ?`, [id], (err, results) => {
      if (err) reject(err);
      else resolve({ message: "Jackpot deleted successfully" });
    });
  });
};
