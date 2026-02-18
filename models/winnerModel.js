import db from "../config/db.js";

export const getWinners = async () => {
  const { rows } = await db.query(
    "SELECT * FROM winners ORDER BY draw_date DESC"
  );
  return rows;
};

export const getWinnerById = async (id) => {
  const { rows } = await db.query("SELECT * FROM winners WHERE id = $1", [id]);
  return rows[0];
};

export const createWinner = async (lottery_id, name, prize, draw_date) => {
  const { rows } = await db.query(
    "INSERT INTO winners (lottery_id, name, prize, draw_date) VALUES ($1, $2, $3, $4) RETURNING id",
    [lottery_id, name, prize, draw_date]
  );
  return { id: rows[0].id };
};

export const deleteWinner = async (id) => {
  await db.query("DELETE FROM winners WHERE id = $1", [id]);
};
