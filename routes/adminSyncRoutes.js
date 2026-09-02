import express from "express";
import { adminSessionAuth } from "../middleware/adminSessionAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  listRunsHandler,
  getRunHandler,
  manualRunHandler,
  retryRunHandler,
  overrideDrawHandler
} from "../controllers/syncRunController.js";

const router = express.Router();

router.use(adminSessionAuth, requireRole("admin", "superadmin"));

router.get("/runs", listRunsHandler);
router.get("/runs/:id", getRunHandler);
router.post("/runs", manualRunHandler);
router.post("/runs/:id/retry", retryRunHandler);
router.patch("/draw/:postId/override", overrideDrawHandler);

export default router;