import express from "express";
import {
  getFaqs,
  getFaq,
  addFaq,
  removeFaq,
} from "../controllers/faqController.js";

const router = express.Router();

router.get("/", getFaqs);
router.get("/:id", getFaq);
router.post("/", addFaq);
router.delete("/:id", removeFaq);

export default router;
