import express from "express";
import {
  getLotteries,
  // getLottery,
  addLottery,
  removeLottery,
  updateLottery,
  getLotteryBySlug,
  getLotterybyName,
} from "../controllers/lotteryController.js";

const router = express.Router();

router.get("/", getLotteries);
// router.get("/:id", getLottery);
router.get("/slug/", getLotteryBySlug);
router.get("/:Name", getLotterybyName);
router.put("/:id", updateLottery);
router.post("/", addLottery);
router.delete("/:id", removeLottery);

export default router;
