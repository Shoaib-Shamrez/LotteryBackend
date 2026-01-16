import db from "../config/db.js";

export const getWinners = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM winners ORDER BY draw_date DESC",
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};

export const getWinnerById = (id) => {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM winners WHERE id = ?", [id], (err, results) => {
      if (err) reject(err);
      else resolve(results[0]);
    });
  });
};

export const createWinner = (lottery_id, name, prize, draw_date) => {
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO winners (lottery_id, name, prize, draw_date) VALUES (?, ?, ?, ?)",
      [lottery_id, name, prize, draw_date],
      (err, result) => {
        if (err) reject(err);
        else resolve({ id: result.insertId });
      }
    );
  });
};

export const deleteWinner = (id) => {
  return new Promise((resolve, reject) => {
    db.query("DELETE FROM winners WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};
