// models/subscriberModel.js
import db from "../config/db.js";

// Add a new subscriber
// export const addSubscriber = async (name, email) => {
//   const [result] = await db.execute(
//     "INSERT INTO subscribers (name, email) VALUES (?, ?)",
//     [name || null, email]
//   );
//   return result.insertId;
// };
export const addSubscriber = (name, email) => {
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO subscribers (name, email) VALUES (?, ?)",
      [name || null, email],
      (err, result) => {
        if (err) reject(err);
        else resolve({ id: result.insertId });
      }
    );
  });
};

// Check if subscriber already exists
export const getSubscriberByEmail = (email) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM subscribers WHERE email = ?",
      [email],
      (err, results) => {
        if (err) return reject(err);
        resolve(results[0]);
      }
    );
  });
};

// Optional: fetch all subscribers (for admin)
export const getAllSubscribers = async () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT email FROM subscribers", (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};
