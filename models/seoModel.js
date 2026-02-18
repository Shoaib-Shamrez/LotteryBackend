import db from "../config/db.js";

export const getAllMeta = async () => {
  const { rows } = await db.query("SELECT * FROM seo_settings");
  return rows;
};

export const getMetaByPage = async (page) => {
  const { rows } = await db.query(
    "SELECT * FROM seo_settings WHERE page_name = $1",
    [page]
  );
  return rows[0];
};

export const updateMeta = async (page, title, description) => {
  const { rowCount } = await db.query(
    "UPDATE seo_settings SET meta_title = $1, meta_description = $2 WHERE page_name = $3",
    [title, description, page]
  );
  return { affectedRows: rowCount };
};
