import db from "../config/db.js";

export const getAllNames = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT NAME FROM lotteries ORDER BY id ", (err, results) => {
      if (err) reject(err);
      else resolve(results.map((row) => row.NAME));
    });
  });
};

export const getLotteryBySlug = (slug) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM lotteries WHERE slug = ?",
      [slug],
      (err, results) => {
        if (err) reject(err);
        else if (!results.length) resolve(null);
        else {
          const lottery = results[0];
          resolve({
            ...lottery,
            How_To_Play: parseValue(lottery.How_To_Play),
            Winners: parseValue(lottery.Winners),
          });
        }
      }
    );
  });
};
export const getLotteryByName = (Name) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM lotteries WHERE NAME = ?",
      [Name],
      (err, results) => {
        if (err) reject(err);
        else if (!results.length) resolve(null);
        else {
          const lottery = results[0];
          resolve({
            ...lottery,
            How_To_Play: parseValue(lottery.How_To_Play),
            Winners: parseValue(lottery.Winners),
          });
        }
      }
    );
  });
};

export const updateLotteryById = (id, fields) => {
  const setClause = Object.keys(fields)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(fields);
  values.push(id);

  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE lotteries SET ${setClause} WHERE id = ?`,
      values,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const createLottery = (
  name,
  slug,
  history,
  How_To_Play,
  Winners,
  description,
  draw_days,
  draw_time
) => {
  return new Promise((resolve, reject) => {
    const parsedHowToPlay = Array.isArray(How_To_Play)
      ? JSON.stringify(How_To_Play)
      : How_To_Play;
    const parsedWinners = Array.isArray(Winners)
      ? JSON.stringify(Winners)
      : Winners;

    db.query(
      "INSERT INTO `lotteries`(`NAME`, `slug`, `description`, `History`, `How_To_Play`, `Winners`, `draw_days`, `draw_time`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        slug,
        description,
        history,
        parsedHowToPlay,
        parsedWinners,
        draw_days,
        draw_time,
      ],
      (err, result) => {
        if (err) reject(err);
        else resolve({ id: result.insertId });
      }
    );
  });
};

export const deleteLottery = (id) => {
  return new Promise((resolve, reject) => {
    db.query("DELETE FROM lotteries WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// ✅ This function handles both JSON and comma-separated text
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
