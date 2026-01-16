import {
  getAllNames,
  getLotteryByName as fetchlotterybyN,
  updateLotteryById,
  createLottery,
  deleteLottery,
  getLotteryBySlug as fetchLotteryBySlug,
} from "../models/lotteryModel.js";

export const getLotteries = async (req, res) => {
  try {
    const lotteries = await getAllNames();
    res.json(lotteries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getLotteryBySlug = async (req, res) => {
  try {
    const lottery = await fetchLotteryBySlug(req.query.slug);
    if (!lottery) return res.status(404).json({ message: "Lottery not found" });
    res.json(lottery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLotterybyName = async (req, res) => {
  try {
    const lottery = await fetchlotterybyN(req.params.Name);
    if (!lottery) return res.status(404).json({ message: "Lottery not found" });
    res.json(lottery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addLottery = async (req, res) => {
  const {
    NAME,
    slug,
    History,
    How_To_Play,
    Winners,
    description,
    draw_days,
    draw_time,
  } = req.body;

  try {
    const newLottery = await createLottery(
      NAME,
      slug,
      History,
      How_To_Play,
      Winners,
      description,
      draw_days,
      draw_time
    );
    res.status(201).json(newLottery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeLottery = async (req, res) => {
  try {
    await deleteLottery(req.params.id);
    res.json({ message: "Lottery deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const updateLottery = async (req, res) => {
  const { id } = req.params;
  let fields = req.body;

  // Convert arrays to JSON strings for How_To_Play and Winners
  if (fields.How_To_Play && Array.isArray(fields.How_To_Play)) {
    fields.How_To_Play = JSON.stringify(fields.How_To_Play);
  }
  if (fields.Winners && Array.isArray(fields.Winners)) {
    fields.Winners = JSON.stringify(fields.Winners);
  }

  try {
    await updateLotteryById(id, fields);
    res.json({ message: "Lottery updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
