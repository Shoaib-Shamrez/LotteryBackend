import db from "../config/db.js";

export const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, name, email, password, role,  DATE_FORMAT(created_at, '%Y-%m-%d') as date FROM users ORDER BY created_at DESC",
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};

export const getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ?",
      [email],
      (err, result) => {
        if (err) {
          console.error("Database error in getUserByEmail:", err);
          reject(err);
        } else {
          console.log("User query result:", result); // Debug log
          resolve(result[0]); // Return first user or undefined
        }
      }
    );
  });
};

export const createUser = (name, email, password, role) => {
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, password, role],
      (err, result) => {
        if (err) reject(err);
        else resolve({ id: result.insertId });
      }
    );
  });
};
export const updateUser = (name, email, password, role, id) => {
  return new Promise((resolve, reject) => {
    // If password is provided, update it. Otherwise, don't include it in the query.
    if (password) {
      db.query(
        "UPDATE `users` SET `name`=?, `email`=?, `password`=?, `role`=? WHERE `id`=?",
        [name, email, password, role, id],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    } else {
      db.query(
        "UPDATE `users` SET `name`=?, `email`=?, `role`=? WHERE `id`=?",
        [name, email, role, id],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    }
  });
};

export const deleteUser = (id) => {
  return new Promise((resolve, reject) => {
    db.query("DELETE FROM users WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};
export const CountSubs = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT COUNT(*) as total_subscribers FROM subscribers",
      (err, result) => {
        if (err) reject(err);
        else resolve(result[0]); // Returns { total_subscribers: 5 }
      }
    );
  });
};
