import express from "express";
import {
  getPosts,
  getPostsNumber,
  getSinglePost,
  addPost,
  getCategories,
  getCategoriesNum,
  removePost,
  updatePostbyid,
  getlatPostbyCat,
  getAlllatPostsbyCat,
  getallmiddaybycat,
  getalleveningbycat,
  getlatestposts,
  getSinglePostbyCatAndDte,
} from "../controllers/postController.js";

const router = express.Router();

router.get("/", getPosts);
router.get("/recent", getlatestposts);
router.get("/n", getPostsNumber);
router.get("/category", getCategories);
router.get("/category/n", getCategoriesNum);
router.get("/id/:id", getSinglePost);
router.get("/all/:category", getAlllatPostsbyCat);
router.get("/midday/:category", getallmiddaybycat);
router.get("/evening/:category", getalleveningbycat);
router.get("/:date/:category", getSinglePostbyCatAndDte);
router.get("/:category", getlatPostbyCat);
router.put("/:id", updatePostbyid);
router.post("/", addPost);
router.delete("/:id", removePost);

export default router;
