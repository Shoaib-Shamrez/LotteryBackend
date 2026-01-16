import {
  createJackpot,
  deleteJackpot,
  getAllJackpots,
  getJackpotById,
  getLatestJackpot,
  getLatestJackpotByCategory,
  updateJackpot,
} from "../models/jackpotModel.js";

export const getJackpots = async (req, res) => {
  try {
    const jackpots = await getAllJackpots();
    res.json(jackpots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getJackpotByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const jackpot = await getJackpotById(id);

    if (jackpot.length === 0) {
      return res.status(404).json({ message: "Jackpot not found" });
    }

    res.json(jackpot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getlatestJackpot = async (req, res) => {
  try {
    const jackpot = await getLatestJackpot();
    res.json(jackpot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getlatesjackpotwithCat = async (req, res) => {
  const { category } = req.params;
  try {
    const jackpotBycategory = await getLatestJackpotByCategory(category);
    res.json(jackpotBycategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// Create Jackpot
export const createJackpotController = async (req, res) => {
  try {
    const newJackpot = await createJackpot(req.body);
    res.status(201).json(newJackpot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Jackpot
export const updateJackpotController = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await updateJackpot(id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Jackpot
export const deleteJackpotController = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await deleteJackpot(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
