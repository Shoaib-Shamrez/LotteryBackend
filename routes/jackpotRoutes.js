import express from "express";
import {
  createJackpotController,
  deleteJackpotController,
  getJackpotByIdController,
  getJackpots,
  getlatesjackpotwithCat,
  getlatestJackpot,
  updateJackpotController,
} from "../controllers/jackpotController.js";

const router = express.Router();

router.get("/", getJackpots);
router.get("/latest", getlatestJackpot);
router.get("/category/:category", getlatesjackpotwithCat);
router.get("/:id", getJackpotByIdController);
router.post("/", createJackpotController);
router.put("/:id", updateJackpotController);
router.delete("/:id", deleteJackpotController);
export default router;
