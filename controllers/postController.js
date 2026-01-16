import {
  getAllPosts,
  getPostById,
  getCat,
  getCatNum,
  getpostn,
  createPost,
  deletePost,
  updatePost,
  getLatestpostbycategory,
  getAllLatestpostsbycategory,
  getAllMiddayLatestresultssbycategory,
  getAllEveningLatestresultssbycategory,
  getLatestPosts,
  getPostByCategoryAndDate,
} from "../models/postModel.js";
import { getAllSubscribers } from "../models/subscriberModel.js";
import { sendPostNotificationEmails } from "../utils/emailService.js";
import { addPostToSitemap } from "../utils/sitemapService.js";

export const getPosts = async (req, res) => {
  try {
    const posts = await getAllPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getlatestposts = async (req, res) => {
  try {
    const posts = await getLatestPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getlatPostbyCat = async (req, res) => {
  const { category } = req.params;
  try {
    const posts = await getLatestpostbycategory(category);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getAlllatPostsbyCat = async (req, res) => {
  const { category } = req.params;
  try {
    const posts = await getAllLatestpostsbycategory(category);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getCategories = async (req, res) => {
  try {
    const categories = await getCat();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err.message);
  }
};
export const getCategoriesNum = async (req, res) => {
  try {
    const categories = await getCatNum();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err.message);
  }
};
export const getPostsNumber = async (req, res) => {
  try {
    const categories = await getpostn();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err.message);
  }
};
export const updatePostbyid = async (req, res) => {
  const { id } = req.params;
  const postData = req.body;

  try {
    // Basic validation
    if (!id) return res.status(400).json({ message: "Post ID is required" });

    // Call model function
    const result = await updatePost(id, postData);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({ message: "Post updated successfully" });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSinglePost = async (req, res) => {
  try {
    const post = await getPostById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getSinglePostbyCatAndDte = async (req, res) => {
  const { date, category } = req.params;
  try {
    const post = await getPostByCategoryAndDate(date, category);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getallmiddaybycat = async (req, res) => {
  try {
    const post = await getAllMiddayLatestresultssbycategory(
      req.params.category
    );
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getalleveningbycat = async (req, res) => {
  try {
    const post = await getAllEveningLatestresultssbycategory(
      req.params.category
    );
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addPost = async (req, res) => {
  const {
    title,
    category,
    status,
    date,
    MiddaywinningNumbers,
    EveningwinningNumbers,
    description,
    metaTitle,
    metaDescription,
  } = req.body;

  try {
    // ✅ Step 1: Create post in database (MUST succeed)
    console.log("📝 Step 1: Creating post in database...");
    const newPost = await createPost(
      title,
      category,
      status,
      date,
      MiddaywinningNumbers,
      EveningwinningNumbers,
      description,
      metaTitle,
      metaDescription
    );

    const postId = newPost.id;
    console.log(`✓ Post created successfully! ID: ${postId}\n`);

    // ✅ Step 2: Generate post URL
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const formattedDate = new Date(date).toISOString().split("T")[0];
    const categorySlug = category.toLowerCase().replace(/\s+/g, "-");
    const postUrl = `${baseUrl}/${categorySlug}/results/${formattedDate}`;

    console.log(`🔗 Post URL: ${postUrl}\n`);

    // ✅ Step 3: Fire independent background tasks (DON'T AWAIT)
    // This allows both to run in parallel without blocking the response

    // 📧 Task 1: Send emails (independent)
    getAllSubscribers()
      .then((subscribers) => {
        if (!subscribers || subscribers.length === 0) {
          console.log("⚠ No subscribers found, skipping email notifications\n");
          return;
        }

        const postData = {
          title,
          category,
          date,
          description,
        };

        // Fire and forget - don't await
        sendPostNotificationEmails(postData, subscribers, postUrl).catch(
          (error) => {
            console.error("📧 Email notification error:", error.message);
          }
        );
      })
      .catch((error) => {
        console.error("📧 Failed to fetch subscribers:", error.message);
      });

    // 🗺️ Task 2: Update sitemap (independent)
    addPostToSitemap({
      title,
      category,
      date,
      id: postId,
    }).catch((error) => {
      console.error("🗺️  Sitemap update error:", error.message);
    });

    res.status(201).json({
      success: true,
      message:
        "Post created successfully! Email notifications and sitemap update in progress.",
      id: postId,
      postUrl: postUrl,
    });
  } catch (err) {
    console.error("\n✗ ERROR CREATING POST:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const removePost = async (req, res) => {
  try {
    await deletePost(req.params.id);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
