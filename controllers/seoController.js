import { getAllMeta, getMetaByPage, updateMeta } from "../models/seoModel.js";

export const getAllSEO = async (req, res) => {
  try {
    const meta = await getAllMeta();
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getSEOByPage = async (req, res) => {
  try {
    const meta = await getMetaByPage(req.params.page);
    if (!meta)
      return res.status(404).json({ message: "Page metadata not found" });
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSEO = async (req, res) => {
  const { page } = req.params;
  const { meta_title, meta_description } = req.body;
  try {
    await updateMeta(page, meta_title, meta_description);
    res.json({ message: "Meta data updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
