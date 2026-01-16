import express from "express";
// import {} from "../controller/userController.js";
import {
  addUser,
  getSubscriberCount,
  getUser,
  getUsers,
  loginUser,
  removeUser,
  userUpdate,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/users", getUsers);
router.get("/subs", getSubscriberCount);

router.post("/login", loginUser);

router.get("/user/:email", getUser);
router.put("/:id", userUpdate);
router.post("/adduser", addUser);
router.delete("/:id", removeUser);

export default router;
