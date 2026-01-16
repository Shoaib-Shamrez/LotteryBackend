// routes/subscriberRoutes.js
import express from "express";
import rateLimit from "express-rate-limit";
import {
  subscribeUser,
  fetchAllSubscribers,
} from "../controllers/subscriberController.js";

const router = express.Router();

// Optional rate limiter — max 3 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: "Too many subscription attempts. Please try again later.",
});

// Public subscription route
router.post("/subscribe", limiter, subscribeUser);

// Optional admin route
router.get("/", fetchAllSubscribers);

export default router;
