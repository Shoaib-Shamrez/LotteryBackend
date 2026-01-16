import express from "express";
import {
  getPages,
  getPage,
  addPage,
  updatePage,
  removePage,
} from "../controllers/PageController.js";

const router = express.Router();

router.get("/", getPages);
router.get("/:slug", getPage);
router.post("/", addPage);
router.put("/:slug", updatePage);
router.delete("/:slug", removePage);

export default router;
