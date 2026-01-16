import express from "express";
import {
  getPrizeBreakdowns,
  createPrizeBreakdown,
  deletePrizeBreakdownByPost,
  editPrizeBreakdown,
  deleteSinglePrizeBreakdown,
  getPrizeBreakdownsbyDraw,
} from "../controllers/prizeBreakdown.js";

const router = express.Router();

router.get("/:postId", getPrizeBreakdowns);
router.get("/:postId/:draw_type", getPrizeBreakdownsbyDraw);
//new row
router.post("/", createPrizeBreakdown);
router.delete("/post/:postId", deletePrizeBreakdownByPost);
//update row
router.put("/:id", editPrizeBreakdown);

// Delete single row by row ID
router.delete("/:id", deleteSinglePrizeBreakdown);
// router.get("/:postId/totals", getTotals);

export default router;
