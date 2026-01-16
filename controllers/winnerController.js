import {
  getWinners,
  getWinnerById,
  createWinner,
  deleteWinner,
} from "../models/winnerModel.js";

export const getAllWinners = async (req, res) => {
  try {
    const winners = await getWinners();
    res.json(winners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getWinner = async (req, res) => {
  try {
    const winner = await getWinnerById(req.params.id);
    if (!winner) return res.status(404).json({ message: "Winner not found" });
    res.json(winner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addWinner = async (req, res) => {
  const { lottery_id, name, prize, draw_date } = req.body;
  try {
    const newWinner = await createWinner(lottery_id, name, prize, draw_date);
    res.status(201).json(newWinner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeWinner = async (req, res) => {
  try {
    await deleteWinner(req.params.id);
    res.json({ message: "Winner deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
