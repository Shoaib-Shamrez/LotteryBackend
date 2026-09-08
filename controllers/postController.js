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
import { addPostToSitemap, bustSitemapCache } from "../utils/sitemapService.js";
import { generateSeoFields } from "../utils/seoService.js";
import { autoGeneratePrizeBreakdowns } from "../utils/prizeBreakdownService.js";

function resolveMetaField({ submitted, existing, fallback }) {
  const s = (submitted === null || submitted === undefined ? "" : String(submitted)).trim();
  if (s) return { value: s, autoFilled: false };
  const e = (existing === null || existing === undefined ? "" : String(existing)).trim();
  if (e) return { value: e, autoFilled: false };
  return { value: fallback, autoFilled: true };
}

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

    // Apply the meta-fill rule: if submitted value is empty, preserve the
    // existing DB value; otherwise auto-generate from post attributes.
    let existing = null;
    try {
      existing = await getPostById(id);
    } catch (e) {
      existing = null;
    }
    if (!existing) {
      return res.status(404).json({ message: "Post not found" });
    }

    const generated = generateSeoFields({
      category: existing.category,
      date: existing.created_at,
      middayWinningNumbers: existing.midday_winnings,
      eveningWinningNumbers: existing.evening_winnings,
      title: postData.title || existing.title
    });
    const resolvedTitle = resolveMetaField({
      submitted: postData.meta_title ?? postData.metaTitle,
      existing: existing.meta_title,
      fallback: generated.metaTitle
    });
    const resolvedDesc = resolveMetaField({
      submitted: postData.meta_desc ?? postData.metaDescription,
      existing: existing.meta_desc,
      fallback: generated.metaDescription
    });

    postData.meta_title = resolvedTitle.value;
    postData.meta_desc = resolvedDesc.value;
    postData.metaTitle = resolvedTitle.value;
    postData.metaDescription = resolvedDesc.value;

    // Call model function
    const result = await updatePost(id, postData);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    bustSitemapCache();

    res.status(200).json({
      message: "Post updated successfully",
      fieldsAutoFilled: {
        metaTitle: resolvedTitle.autoFilled,
        metaDescription: resolvedDesc.autoFilled
      }
    });
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
    // Step 1: resolve meta fields. Rule: submitted non-empty -> use it;
    // otherwise auto-generate (no existing row on create). Frontend can
    // surface `fieldsAutoFilled` to inform the admin.
    const generated = generateSeoFields({
      category,
      date,
      middayWinningNumbers: Array.isArray(MiddaywinningNumbers)
        ? MiddaywinningNumbers
        : (typeof MiddaywinningNumbers === "string" && MiddaywinningNumbers.length
            ? MiddaywinningNumbers.split(",").map((s) => s.trim()).filter(Boolean)
            : []),
      eveningWinningNumbers: Array.isArray(EveningwinningNumbers)
        ? EveningwinningNumbers
        : (typeof EveningwinningNumbers === "string" && EveningwinningNumbers.length
            ? EveningwinningNumbers.split(",").map((s) => s.trim()).filter(Boolean)
            : []),
      title
    });
    const resolvedTitle = resolveMetaField({
      submitted: metaTitle, existing: "", fallback: generated.metaTitle
    });
    const resolvedDesc = resolveMetaField({
      submitted: metaDescription, existing: "", fallback: generated.metaDescription
    });

    // Step 2: Create post in database (MUST succeed)
    console.log("📝 Step 1: Creating post in database...");
    const newPost = await createPost(
      title,
      category,
      status,
      date,
      MiddaywinningNumbers,
      EveningwinningNumbers,
      description,
      resolvedTitle.value,
      resolvedDesc.value
    );

    const postId = newPost.id;
    console.log(`✓ Post created successfully! ID: ${postId}\n`);

    // Step 3: Generate post URL
    const baseUrl = process.env.APP_URL || "https://nylotteryresults.com";
    const formattedDate = new Date(date).toISOString().split("T")[0];
    const categorySlug = category.toLowerCase().replace(/\s+/g, "-");
    const postUrl = `${baseUrl}/${categorySlug}/results/${formattedDate}`;

    console.log(`🔗 Post URL: ${postUrl}\n`);

    // Step 4: Bust sitemap cache so the next dynamic GET reflects this new post.
    bustSitemapCache();

    // Auto-generate the static prize-tier skeleton for the new draw.
    // Fire-and-forget: best-effort, must never fail the post creation.
    autoGeneratePrizeBreakdowns({
      postId,
      category: String(category || "").toLowerCase(),
      post: {
        midday_winnings: MiddaywinningNumbers,
        evening_winnings: EveningwinningNumbers
      }
    }).catch((err) => console.error("🗺️  Auto prize breakdown generation error:", err.message));

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
      fieldsAutoFilled: {
        metaTitle: resolvedTitle.autoFilled,
        metaDescription: resolvedDesc.autoFilled
      }
    });
  } catch (err) {
    console.error("\n✗ ERROR CREATING POST:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const removePost = async (req, res) => {
  try {
    await deletePost(req.params.id);
    bustSitemapCache();
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
