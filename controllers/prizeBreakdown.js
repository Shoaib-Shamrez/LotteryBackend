import {
  getPrizeBreakdownsByPost,
  addPrizeBreakdown,
  deletePrizeBreakdowns,
  updatePrizeBreakdown,
  deletePrizeBreakdown,
  getPrizeBreakdownsByPostAndDraw,
} from "../models/prizeBreakModel.js";

export const getPrizeBreakdowns = async (req, res) => {
  try {
    const { postId } = req.params;
    const data = await getPrizeBreakdownsByPost(postId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getPrizeBreakdownsbyDraw = async (req, res) => {
  try {
    const { postId, draw_type } = req.params;
    const data = await getPrizeBreakdownsByPostAndDraw(postId, draw_type);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const editPrizeBreakdown = async (req, res) => {
  try {
    const { id } = req.params; // This is the ROW id

    const result = await updatePrizeBreakdown(id, req.body);

    // Return the updated row data
    res.json({
      message: "Updated successfully",
      id: parseInt(id),
      ...req.body,
    });
  } catch (error) {
    console.error("Error updating prize breakdown:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createPrizeBreakdown = async (req, res) => {
  try {
    const result = await addPrizeBreakdown(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deletePrizeBreakdownByPost = async (req, res) => {
  try {
    const { postId } = req.params;
    await deletePrizeBreakdowns(postId);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const deleteSinglePrizeBreakdown = async (req, res) => {
  try {
    const { id } = req.params;

    await deletePrizeBreakdown(id);
    res.json({ message: "Row deleted successfully" });
  } catch (err) {
    console.error("Error deleting prize breakdown:", err);
    res.status(500).json({ error: err.message });
  }
};
