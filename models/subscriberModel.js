// models/subscriberModel.js
import db from "../config/db.js";

// Add a new subscriber
export const addSubscriber = async (name, email) => {
  const { rows } = await db.query(
    "INSERT INTO subscribers (name, email) VALUES ($1, $2) RETURNING id",
    [name || null, email]
  );
  return { id: rows[0].id };
};

// Check if subscriber already exists
export const getSubscriberByEmail = async (email) => {
  const { rows } = await db.query("SELECT * FROM subscribers WHERE email = $1", [
    email,
  ]);
  return rows[0];
};

// Optional: fetch all subscribers (for admin)
export const getAllSubscribers = async () => {
  const { rows } = await db.query("SELECT email FROM subscribers");
  return rows;
};
