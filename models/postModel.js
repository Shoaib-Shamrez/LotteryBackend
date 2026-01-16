import db from "../config/db.js";

export const getAllPosts = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, title, status, content, category, Date(created_at) AS date FROM `posts` ORDER BY created_at DESC;",
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getLatestPosts = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, title, status, content, category, Date(created_at) AS date FROM `posts` ORDER BY created_at DESC LIMIT 5;",
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getLatestpostbycategory = (category) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM `posts` WHERE category = ? ORDER BY created_at DESC LIMIT 1;",
      [category],
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getAllLatestpostsbycategory = (category) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM `posts` WHERE category = ? ORDER BY created_at DESC;",
      [category],
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getAllMiddayLatestresultssbycategory = (category) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, title, Midday_Winnings, created_at FROM `posts` WHERE category = ? ORDER BY created_at DESC;",
      [category],

      (err, results) => {
        if (err) reject(err);
        else {
          resolve(results);
        }
      }
    );
  });
};
export const getAllEveningLatestresultssbycategory = (category) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, title, Evening_Winnings, created_at FROM `posts` WHERE category = ? ORDER BY created_at DESC;",
      [category],

      (err, results) => {
        if (err) reject(err);
        else {
          resolve(results);
        }
      }
    );
  });
};

export const updatePost = (id, postData) => {
  const {
    title,
    category,
    status,
    created_at,
    content,
    meta_title,
    meta_desc,
    Midday_Winnings,
    Evening_Winnings,
  } = postData;

  const query = `
    UPDATE posts 
    SET 
      title = ?, 
      category = ?, 
      status = ?, 
      created_at = ?, 
      content = ?, 
      meta_title = ?, 
      meta_desc = ?, 
      Midday_Winnings = ?, 
      Evening_Winnings = ?
    WHERE id = ?
  `;

  return new Promise((resolve, reject) => {
    db.query(
      query,
      [
        title,
        category,
        status,
        created_at,
        content,
        meta_title,
        meta_desc,
        JSON.stringify(Midday_Winnings),
        JSON.stringify(Evening_Winnings),
        id,
      ],
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
};
export const getCat = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT id, slug FROM lotteries", (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};
export const getCatNum = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT COUNT(DISTINCT slug) as Numbers FROM lotteries",
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};
export const getpostn = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT COUNT(*) as Numbers FROM posts", (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

export const getPostById = (id) => {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM posts WHERE id = ?", [id], (err, results) => {
      if (err) reject(err);
      else {
        const Post = results[0];
        resolve({
          ...Post,
          Midday_Winnings: parseValue(Post.Midday_Winnings),
          Evening_Winnings: parseValue(Post.Evening_Winnings),
        });
      }
    });
  });
};
export const getPostByCategoryAndDate = (date, category) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM posts WHERE created_at = ? AND category = ? ",
      [date, category],
      (err, results) => {
        if (err) reject(err);
        else {
          const Post = results[0];
          resolve({
            ...Post,
            Midday_Winnings: parseValue(Post.Midday_Winnings),
            Evening_Winnings: parseValue(Post.Evening_Winnings),
          });
        }
      }
    );
  });
};

export const createPost = (
  title,
  category,
  status,
  date,
  MiddaywinningNumbers,
  EveningwinningNumbers,
  description,
  metaTitle,
  metaDescription
) => {
  return new Promise((resolve, reject) => {
    if (Array.isArray(MiddaywinningNumbers)) {
      MiddaywinningNumbers = JSON.stringify(MiddaywinningNumbers);
    }
    if (Array.isArray(EveningwinningNumbers)) {
      EveningwinningNumbers = JSON.stringify(EveningwinningNumbers);
    }
    db.query(
      "INSERT INTO posts (title, category, content, Midday_Winnings, Evening_Winnings, created_at, meta_title, meta_desc, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        category,
        description,
        MiddaywinningNumbers,
        EveningwinningNumbers,
        date,
        metaTitle,
        metaDescription,
        status,
      ],
      (err, result) => {
        if (err) reject(err);
        else resolve({ id: result.insertId });
      }
    );
  });
};

export const deletePost = (id) => {
  return new Promise((resolve, reject) => {
    db.query("DELETE FROM posts WHERE id = ?", [id], (err) => {
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
