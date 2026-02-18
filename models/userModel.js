import db from "../config/db.js";

export const getAllUsers = async () => {
  const { rows } = await db.query(
    "SELECT id, name, email, password, role, created_at::date as date FROM users ORDER BY created_at DESC"
  );
  return rows;
};

export const getUserByEmail = async (email) => {
  const { rows } = await db.query(
    "SELECT id, name, email, password, role, created_at FROM users WHERE email = $1",
    [email]
  );
  return rows[0];
};

export const createUser = async (name, email, password, role) => {
  const { rows } = await db.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [name, email, password, role]
  );
  return { id: rows[0].id, name, email, role };
};

export const updateUser = async (name, email, password, role, id) => {
  let query;
  let values;

  if (password) {
    query =
      "UPDATE users SET name = $1, email = $2, password = $3, role = $4 WHERE id = $5";
    values = [name, email, password, role, id];
  } else {
    query = "UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4";
    values = [name, email, role, id];
  }

  const { rowCount } = await db.query(query, values);
  return { affectedRows: rowCount };
};

export const deleteUser = async (id) => {
  await db.query("DELETE FROM users WHERE id = $1", [id]);
};

export const CountSubs = async () => {
  const { rows } = await db.query(
    "SELECT COUNT(*) as total_subscribers FROM subscribers"
  );
  return rows[0];
};
