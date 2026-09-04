import db from "../config/db.js";

export const getPrizeBreakdownsByPost = async (postId) => {
  // 1️⃣ First query: get all prize breakdown rows
  const { rows: prizeRows } = await db.query(
    "SELECT * FROM prize_breakdowns WHERE post_id = $1 ORDER BY draw_type, id",
    [postId]
  );

  // 2️⃣ Second query: get totals per draw type
  const { rows: totals } = await db.query(
    `SELECT draw_type, SUM(winners) AS total
     FROM prize_breakdowns
     WHERE post_id = $1
     GROUP BY draw_type`,
    [postId]
  );

  // 3️⃣ Combine both results
  return {
    prizes: prizeRows,
    totals: totals.reduce((acc, row) => {
      acc[row.draw_type] = row.total;
      return acc;
    }, {}),
  };
};

export const getPrizeBreakdownsByPostAndDraw = async (postId, draw_type) => {
  // 1️⃣ First query: get all prize breakdown rows
  const { rows: prizeRows } = await db.query(
    "SELECT * FROM prize_breakdowns WHERE post_id = $1 AND draw_type = $2",
    [postId, draw_type]
  );

  // 2️⃣ Second query: get totals per draw type
  const { rows: totals } = await db.query(
    `SELECT draw_type, SUM(winners) AS total
     FROM prize_breakdowns
     WHERE post_id = $1 AND draw_type = $2
     GROUP BY draw_type`,
    [postId, draw_type]
  );

  // 3️⃣ Combine both results
  return {
    prizes: prizeRows,
    totals: totals.reduce((acc, row) => {
      acc[row.draw_type] = row.total;
      return acc;
    }, {}),
  };
};

// Add a new prize breakdown row
export const addPrizeBreakdown = async (data) => {
  const { post_id, draw_type, category, winners, prize_amount } = data;
  const { rows } = await db.query(
    "INSERT INTO prize_breakdowns (post_id, draw_type, category, winners, prize_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [post_id, draw_type, category, winners, prize_amount || null]
  );
  return { id: rows[0].id };
};

// Add multiple prize-breakdown rows for a post in a single atomic INSERT
// (one statement => all rows or none). Rows: { draw_type, category, winners, prize_amount }
// (winners/prize_amount nullable). This is the batch counterpart to addPrizeBreakdown.
export const addPrizeBreakdownsBatch = async (postId, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { inserted: 0, ids: [] };
  }
  const values = [];
  const placeholders = [];
  let param = 1;
  for (const r of rows) {
    placeholders.push(`($${param}, $${param + 1}, $${param + 2}, $${param + 3}, $${param + 4})`);
    param += 5;
    values.push(
      postId,
      r.draw_type,
      r.category,
      r.winners !== undefined ? r.winners : null,
      r.prize_amount !== undefined ? r.prize_amount : null
    );
  }
  const sql =
    "INSERT INTO prize_breakdowns (post_id, draw_type, category, winners, prize_amount) VALUES " +
    placeholders.join(", ") +
    " RETURNING id";
  const res = await db.query(sql, values);
  return { inserted: res.rowCount, ids: res.rows.map((r) => r.id) };
};

// Delete all prize breakdowns for a post
export const deletePrizeBreakdowns = async (postId) => {
  const { rowCount } = await db.query(
    "DELETE FROM prize_breakdowns WHERE post_id = $1",
    [postId]
  );
  return { affectedRows: rowCount };
};

export const updatePrizeBreakdown = async (id, data) => {
  const { draw_type, category, winners, prize_amount } = data;
  const { rowCount } = await db.query(
    "UPDATE prize_breakdowns SET draw_type=$1, category=$2, winners=$3, prize_amount=$4 WHERE id=$5",
    [draw_type, category, winners, prize_amount || null, id]
  );
  if (rowCount === 0) {
    throw new Error(`No row found with id ${id}`);
  }
  return { affectedRows: rowCount };
};

export const deletePrizeBreakdown = async (id) => {
  const { rowCount } = await db.query(
    "DELETE FROM prize_breakdowns WHERE id = $1",
    [id]
  );
  return { affectedRows: rowCount };
};
