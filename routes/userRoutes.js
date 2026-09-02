import express from "express";
import {
  addUser,
  getSubscriberCount,
  getUser,
  getUsers,
  loginUser,
  logoutUser,
  meUser,
  removeUser,
  userUpdate,
} from "../controllers/userController.js";
import { adminSessionAuth } from "../middleware/adminSessionAuth.js";

const router = express.Router();

router.get("/users", getUsers);
router.get("/subs", getSubscriberCount);

router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/me", adminSessionAuth, meUser);

router.get("/user/:email", getUser);
router.put("/:id", userUpdate);
router.post("/adduser", addUser);
router.delete("/:id", removeUser);

export default router;
