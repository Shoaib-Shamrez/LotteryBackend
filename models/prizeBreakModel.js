import db from "../config/db.js";

export const getPrizeBreakdownsByPost = (postId) => {
  return new Promise((resolve, reject) => {
    // 1️⃣ First query: get all prize breakdown rows
    db.query(
      "SELECT * FROM prize_breakdowns WHERE post_id = ? ORDER BY draw_type, id",
      [postId],
      (err, prizeRows) => {
        if (err) return reject(err);

        // 2️⃣ Second query: get totals per draw type
        db.query(
          `SELECT draw_type, SUM(winners) AS total
           FROM prize_breakdowns
           WHERE post_id = ?
           GROUP BY draw_type`,
          [postId],
          (err2, totals) => {
            if (err2) return reject(err2);

            // 3️⃣ Combine both results
            resolve({
              prizes: prizeRows,
              totals: totals.reduce((acc, row) => {
                acc[row.draw_type] = row.total;
                return acc;
              }, {}), // → { midday: 1200, evening: 1300 }
            });
          }
        );
      }
    );
  });
};
export const getPrizeBreakdownsByPostAndDraw = (postId, draw_type) => {
  return new Promise((resolve, reject) => {
    // 1️⃣ First query: get all prize breakdown rows
    db.query(
      "SELECT * FROM prize_breakdowns WHERE post_id = ? AND draw_type = ?",
      [postId, draw_type],
      (err, prizeRows) => {
        if (err) return reject(err);

        // 2️⃣ Second query: get totals per draw type
        db.query(
          `SELECT draw_type, SUM(winners) AS total
           FROM prize_breakdowns
           WHERE post_id = ? AND draw_type = ?
           GROUP BY draw_type`,
          [postId, draw_type],
          (err2, totals) => {
            if (err2) return reject(err2);

            // 3️⃣ Combine both results
            resolve({
              prizes: prizeRows,
              totals: totals.reduce((acc, row) => {
                acc[row.draw_type] = row.total;
                return acc;
              }, {}), // → { midday: 1200, evening: 1300 }
            });
          }
        );
      }
    );
  });
};

// Add a new prize breakdown row
export const addPrizeBreakdown = (data) => {
  const { post_id, draw_type, category, winners, prize_amount } = data;
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO prize_breakdowns (post_id, draw_type, category, winners, prize_amount) VALUES (?, ?, ?, ?, ?)",
      [post_id, draw_type, category, winners, prize_amount || null],
      (err, result) => {
        if (err) reject(err);
        else resolve({ id: result.insertId });
      }
    );
  });
};

// Delete all prize breakdowns for a post
export const deletePrizeBreakdowns = (postId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM prize_breakdowns WHERE post_id = ?",
      [postId],
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
};

export const updatePrizeBreakdown = (id, data) => {
  const { draw_type, category, winners, prize_amount } = data;
  return new Promise((resolve, reject) => {
    db.query(
      "UPDATE prize_breakdowns SET draw_type=?, category=?, winners=?, prize_amount=? WHERE id=?",
      [draw_type, category, winners, prize_amount || null, id],
      (err, result) => {
        if (err) {
          console.error("Database update error:", err);
          reject(err);
        } else {
          if (result.affectedRows === 0) {
            reject(new Error(`No row found with id ${id}`));
          } else {
            resolve(result);
          }
        }
      }
    );
  });
};
export const deletePrizeBreakdown = (id) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM prize_breakdowns WHERE id = ?",
      [id],
      (err, result) => {
        if (err) {
          console.error("Database delete error:", err);
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};
