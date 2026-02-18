import db from "../config/db.js";

export const getAllFaqs = async () => {
  const { rows } = await db.query("SELECT * FROM faqs ORDER BY id DESC");
  return rows;
};

export const getFaqById = async (id) => {
  const { rows } = await db.query("SELECT * FROM faqs WHERE id = $1", [id]);
  return rows[0];
};

export const createFaq = async (question, answer) => {
  const { rows } = await db.query(
    "INSERT INTO faqs (question, answer) VALUES ($1, $2) RETURNING id",
    [question, answer]
  );
  return { id: rows[0].id };
};

export const deleteFaq = async (id) => {
  await db.query("DELETE FROM faqs WHERE id = $1", [id]);
};
