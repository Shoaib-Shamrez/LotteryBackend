import db from "../config/db.js";

export const getAllPosts = async () => {
  const { rows } = await db.query(
    "SELECT id, title, status, content, category, created_at::date AS date FROM posts ORDER BY created_at DESC"
  );
  return rows;
};

export const getLatestPosts = async () => {
  const { rows } = await db.query(
    "SELECT id, title, status, content, category, created_at::date AS date FROM posts ORDER BY created_at DESC LIMIT 5"
  );
  return rows;
};

export const getLatestpostbycategory = async (category) => {
  const { rows } = await db.query(
    "SELECT * FROM posts WHERE category = $1 ORDER BY created_at DESC LIMIT 1",
    [category]
  );
  return rows;
};

export const getAllLatestpostsbycategory = async (category) => {
  const { rows } = await db.query(
    "SELECT * FROM posts WHERE category = $1 ORDER BY created_at DESC",
    [category]
  );
  return rows;
};

export const getAllMiddayLatestresultssbycategory = async (category) => {
  const { rows } = await db.query(
    "SELECT id, title, midday_winnings, created_at FROM posts WHERE category = $1 ORDER BY created_at DESC",
    [category]
  );
  return rows;
};

export const getAllEveningLatestresultssbycategory = async (category) => {
  const { rows } = await db.query(
    "SELECT id, title, evening_winnings, created_at FROM posts WHERE category = $1 ORDER BY created_at DESC",
    [category]
  );
  return rows;
};

export const updatePost = async (id, postData) => {
  const {
    title,
    category,
    status,
    created_at,
    content,
    meta_title,
    meta_desc,
    midday_winnings,
    evening_winnings,
  } = postData;

  const { rowCount } = await db.query(
    `
    UPDATE posts 
    SET 
      title = $1, 
      category = $2, 
      status = $3, 
      created_at = $4, 
      content = $5, 
      meta_title = $6, 
      meta_desc = $7, 
      midday_winnings = $8, 
      evening_winnings = $9
    WHERE id = $10
  `,
    [
      title,
      category,
      status,
      created_at,
      content,
      meta_title,
      meta_desc,
      JSON.stringify(midday_winnings),
      JSON.stringify(evening_winnings),
      id,
    ]
  );
  return { affectedRows: rowCount };
};

export const getCat = async () => {
  const { rows } = await db.query("SELECT id, slug FROM lotteries");
  return rows;
};

export const getCatNum = async () => {
  const { rows } = await db.query(
    "SELECT COUNT(DISTINCT slug) as Numbers FROM lotteries"
  );
  return rows;
};

export const getpostn = async () => {
  const { rows } = await db.query("SELECT COUNT(*) as Numbers FROM posts");
  return rows;
};

export const getPostById = async (id) => {
  const { rows } = await db.query("SELECT * FROM posts WHERE id = $1", [id]);
  if (rows.length === 0) return null;

  const post = rows[0];
  return {
    ...post,
    midday_winnings: parseValue(post.midday_winnings),
    evening_winnings: parseValue(post.evening_winnings),
  };
};

export const getPostByCategoryAndDate = async (date, category) => {
  const { rows } = await db.query(
    "SELECT * FROM posts WHERE created_at::date = $1 AND category = $2",
    [date, category]
  );
  if (rows.length === 0) return null;

  const post = rows[0];
  return {
    ...post,
    midday_winnings: parseValue(post.midday_winnings),
    evening_winnings: parseValue(post.evening_winnings),
  };
};

export const createPost = async (
  title,
  category,
  status,
  date,
  middaywinningNumbers,
  eveningwinningNumbers,
  description,
  metaTitle,
  metaDescription
) => {
  if (Array.isArray(middaywinningNumbers)) {
    middaywinningNumbers = JSON.stringify(middaywinningNumbers);
  }
  if (Array.isArray(eveningwinningNumbers)) {
    eveningwinningNumbers = JSON.stringify(eveningwinningNumbers);
  }
  const { rows } = await db.query(
    "INSERT INTO posts (title, category, content, midday_winnings, evening_winnings, created_at, meta_title, meta_desc, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    [
      title,
      category,
      description,
      middaywinningNumbers,
      eveningwinningNumbers,
      date,
      metaTitle,
      metaDescription,
      status,
    ]
  );
  return { id: rows[0].id };
};

export const deletePost = async (id) => {
  await db.query("DELETE FROM posts WHERE id = $1", [id]);
};

// This function handles both JSON and comma-separated text
const parseValue = (value) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not valid JSON, fall back to comma-separated parsing
  }

  return value
    .split(",")
    .map((item) => item.trim().replace(/\r?\n|\r/g, ""))
    .filter(Boolean);
};
