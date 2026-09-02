import express from "express";
import { syncAuthMiddleware } from "../middleware/syncAuth.js";
import {
  listRunsHandler,
  getRunHandler,
  manualRunHandler,
  retryRunHandler,
  overrideDrawHandler
} from "../controllers/syncRunController.js";

const router = express.Router();

router.use(syncAuthMiddleware);

router.get("/runs", listRunsHandler);
router.get("/runs/:id", getRunHandler);
router.post("/runs", manualRunHandler);
router.post("/runs/:id/retry", retryRunHandler);
router.patch("/draw/:postId/override", overrideDrawHandler);

export default router;