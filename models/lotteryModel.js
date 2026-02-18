import db from "../config/db.js";

export const getAllNames = async () => {
  const { rows } = await db.query("SELECT NAME FROM lotteries ORDER BY id");
  return rows.map((row) => row.name);
};

export const getLotteryBySlug = async (slug) => {
  const { rows } = await db.query("SELECT * FROM lotteries WHERE slug = $1", [
    slug,
  ]);
  if (rows.length === 0) return null;

  const lottery = rows[0];
  return {
    ...lottery,
    how_to_play: parseValue(lottery.how_to_play),
    winners: parseValue(lottery.winners),
  };
};

export const getLotteryByName = async (name) => {
  const { rows } = await db.query("SELECT * FROM lotteries WHERE NAME = $1", [
    name,
  ]);
  if (rows.length === 0) return null;

  const lottery = rows[0];
  return {
    ...lottery,
    how_to_play: parseValue(lottery.how_to_play),
    winners: parseValue(lottery.winners),
  };
};

export const updateLotteryById = async (id, fields) => {
  const setClause = Object.keys(fields)
    .map((key, index) => `"${key}" = $${index + 1}`)
    .join(", ");
  const values = Object.values(fields);
  values.push(id);

  const query = `UPDATE lotteries SET ${setClause} WHERE id = $${values.length}`;
  await db.query(query, values);
};

export const createLottery = async (
  name,
  slug,
  history,
  how_to_play,
  winners,
  description,
  draw_days,
  draw_time
) => {
  const parsedHowToPlay = Array.isArray(how_to_play)
    ? JSON.stringify(how_to_play)
    : how_to_play;
  const parsedWinners = Array.isArray(winners)
    ? JSON.stringify(winners)
    : winners;

  const { rows } = await db.query(
    "INSERT INTO lotteries (NAME, slug, description, History, how_to_play, winners, draw_days, draw_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    [
      name,
      slug,
      description,
      history,
      parsedHowToPlay,
      parsedWinners,
      draw_days,
      draw_time,
    ]
  );
  return { id: rows[0].id };
};

export const deleteLottery = async (id) => {
  await db.query("DELETE FROM lotteries WHERE id = $1", [id]);
};

// This function handles both JSON and comma-separated text
const parseValue = (value) => {
  if (!value) return [];

  try {
    // Try parsing JSON first
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not valid JSON, fall back to comma-separated parsing
  }

  // Convert comma-separated text into an array
  return value
    .split(",")
    .map((item) => item.trim().replace(/\r?\n|\r/g, ""))
    .filter(Boolean);
};
