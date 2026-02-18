import db from "../config/db.js";

export const getAllJackpots = async () => {
  const { rows } = await db.query(
    "SELECT id, jackpot_category, amount, draw_date, color FROM jackpot ORDER BY draw_date DESC"
  );
  return rows;
};

export const getLatestJackpot = async () => {
  const { rows } = await db.query(
    "SELECT id, jackpot_category, amount, draw_date, color FROM jackpot ORDER BY draw_date DESC LIMIT 1"
  );
  return rows;
};

export const getLatestJackpotByCategory = async (category) => {
  const { rows } = await db.query(
    `SELECT id, jackpot_category, amount, draw_date, color FROM jackpot WHERE jackpot_category = $1 ORDER BY draw_date DESC LIMIT 1`,
    [category]
  );
  return rows;
};

export const getJackpotById = async (id) => {
  const { rows } = await db.query(
    "SELECT id, jackpot_category, amount, draw_date, color FROM jackpot WHERE id = $1",
    [id]
  );
  return rows;
};

export const createJackpot = async (data) => {
  const { jackpot_category, amount, draw_date, color } = data;
  const { rows } = await db.query(
    `INSERT INTO jackpot (jackpot_category, amount, draw_date, color) VALUES ($1, $2, $3, $4) RETURNING id`,
    [jackpot_category, amount, draw_date, color]
  );
  return { id: rows[0].id, ...data };
};

export const updateJackpot = async (id, data) => {
  const { jackpot_category, amount, draw_date, color } = data;
  await db.query(
    `UPDATE jackpot SET jackpot_category = $1, amount = $2, draw_date = $3, color = $4 WHERE id = $5`,
    [jackpot_category, amount, draw_date, color, id]
  );
  return { id, ...data };
};

export const deleteJackpot = async (id) => {
  await db.query(`DELETE FROM jackpot WHERE id = $1`, [id]);
  return { message: "Jackpot deleted successfully" };
};
