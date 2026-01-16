import express from "express";
import {
  getAllWinners,
  getWinner,
  addWinner,
  removeWinner,
} from "../controllers/winnerController.js";

const router = express.Router();

router.get("/", getAllWinners);
router.get("/:id", getWinner);
router.post("/", addWinner);
router.delete("/:id", removeWinner);

export default router;
