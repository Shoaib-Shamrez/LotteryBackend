// utils/sitemapService.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to sitemap.xml in your project root (or public folder)
const SITEMAP_PATH = path.resolve(__dirname, "../public/sitemap.xml");

// In-memory cache for the dynamic sitemap. Busted on every post mutation.
let sitemapCache = null;
let sitemapCacheAt = 0;
const SITEMAP_TTL_MS = 60 * 1000;

export function bustSitemapCache() {
  sitemapCache = null;
  sitemapCacheAt = 0;
}

function escapeXml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateOnly(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateDynamicPostUrl(post, baseUrl) {
  const categorySlug = String(post.category || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-");
  const date = formatDateOnly(post.created_at);
  return `${baseUrl}/${categorySlug}/results/${date}`;
}

function buildXml(posts, baseUrl) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const homeEntry = `  <url>
    <loc>${escapeXml(baseUrl + "/")}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;
  const postEntries = posts
    .map((post) => {
      const url = generateDynamicPostUrl(post, baseUrl);
      const dt = formatDateOnly(post.created_at);
      return `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${dt}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${homeEntry}
${postEntries}
</urlset>`;
}

/**
 * Build a fresh sitemap from the database.
 * @param {Object} opts
 * @param {Object} opts.pool  pg Pool (defaults to ../config/db.js default)
 * @param {string} opts.baseUrl
 */
export async function getDynamicSitemap({ pool, baseUrl } = {}) {
  // Resolve the base URL for sitemap entries.
  // Order of precedence: explicit argument > APP_URL env > default.
  const resolvedBaseUrl = baseUrl || process.env.BASE_URL || process.env.APP_URL || "https://nylotteryresults.com";
  const now = Date.now();
  if (
    sitemapCache &&
    sitemapCache.baseUrl === resolvedBaseUrl &&
    now - sitemapCacheAt < SITEMAP_TTL_MS
  ) {
    return { xml: sitemapCache.xml, fromCache: true };
  }
  let db;
  try {
    db = (await import("../config/db.js")).default;
  } catch (err) {
    throw new Error("Failed to load default db pool: " + err.message);
  }
  const p = pool || db;
  const result = await p.query(
    "SELECT id, category, to_char(created_at, 'YYYY-MM-DD') AS created_at FROM posts WHERE status = 'published' ORDER BY created_at DESC"
  );
  const xml = buildXml(result.rows, resolvedBaseUrl);
  sitemapCache = { xml, baseUrl: resolvedBaseUrl };
  sitemapCacheAt = now;
  return { xml, fromCache: false };
}

// Generate sitemap URL for a post
const generatePostUrl = (post) => {
  const baseUrl = process.env.BASE_URL || process.env.APP_URL || "https://nylotteryresults.com";
  const { category, date } = post;

  // Format: domain.com/categoryName/dateofpost
  const formattedDate = new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD
  const categorySlug = category.toLowerCase().replace(/\s+/g, "-");

  return `${baseUrl}/${categorySlug}/results/${formattedDate}`;
};

// Create initial sitemap if it doesn't exist
const initializeSitemap = () => {
  const initialSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://localhost:3000/</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

  // Create public directory if it doesn't exist
  const publicDir = path.resolve(__dirname, "../public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(SITEMAP_PATH, initialSitemap, "utf8");
  console.log("✓ Sitemap initialized at:", SITEMAP_PATH);
};

// Read existing sitemap
const readSitemap = () => {
  try {
    if (!fs.existsSync(SITEMAP_PATH)) {
      console.log("⚠ Sitemap not found, creating new one...");
      initializeSitemap();
    }
    return fs.readFileSync(SITEMAP_PATH, "utf8");
  } catch (error) {
    console.error("✗ Error reading sitemap:", error.message);
    throw error;
  }
};

// Write sitemap to file
const writeSitemap = (content) => {
  try {
    fs.writeFileSync(SITEMAP_PATH, content, "utf8");
    console.log("✓ Sitemap updated successfully");
    return true;
  } catch (error) {
    console.error("✗ Error writing sitemap:", error.message);
    throw error;
  }
};

// Add new post URL to sitemap
export const addPostToSitemap = async (post) => {
  console.log(`\n🗺️  Adding post to sitemap: "${post.title}"`);

  try {
    // Generate post URL
    const postUrl = generatePostUrl(post);
    console.log(`   URL: ${postUrl}`);

    // Read current sitemap
    let sitemap = readSitemap();

    // Check if URL already exists
    if (sitemap.includes(`<loc>${postUrl}</loc>`)) {
      console.log("   ⚠ URL already exists in sitemap, skipping...");
      return { success: true, message: "URL already exists" };
    }

    // Create new URL entry
    const lastmod = new Date().toISOString().split("T")[0];
    const newEntry = `  <url>
    <loc>${postUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

    // Insert before closing </urlset> tag
    sitemap = sitemap.replace("</urlset>", `${newEntry}\n</urlset>`);

    // Write updated sitemap
    writeSitemap(sitemap);

    console.log(`   ✓ Post added to sitemap\n`);
    return {
      success: true,
      url: postUrl,
      lastmod: lastmod,
    };
  } catch (error) {
    console.error(`   ✗ Failed to add post to sitemap:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Update existing URL in sitemap (useful for post updates)
export const updatePostInSitemap = async (post) => {
  console.log(`\n🗺️  Updating post in sitemap: "${post.title}"`);

  try {
    const postUrl = generatePostUrl(post);
    let sitemap = readSitemap();

    // Check if URL exists
    if (!sitemap.includes(`<loc>${postUrl}</loc>`)) {
      console.log("   ⚠ URL not found, adding as new entry...");
      return addPostToSitemap(post);
    }

    // Update lastmod date for existing URL
    const lastmod = new Date().toISOString().split("T")[0];
    const urlPattern = new RegExp(
      `(<url>[\\s\\S]*?<loc>${postUrl.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}</loc>[\\s\\S]*?)<lastmod>.*?</lastmod>`,
      "g"
    );

    sitemap = sitemap.replace(urlPattern, `$1<lastmod>${lastmod}</lastmod>`);

    writeSitemap(sitemap);
    console.log(`   ✓ Post updated in sitemap\n`);

    return {
      success: true,
      url: postUrl,
      lastmod: lastmod,
    };
  } catch (error) {
    console.error(`   ✗ Failed to update post in sitemap:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Remove post from sitemap (for deleted posts)
export const removePostFromSitemap = async (post) => {
  console.log(`\n🗺️  Removing post from sitemap: "${post.title}"`);

  try {
    const postUrl = generatePostUrl(post);
    let sitemap = readSitemap();

    // Check if URL exists
    if (!sitemap.includes(`<loc>${postUrl}</loc>`)) {
      console.log("   ⚠ URL not found in sitemap");
      return { success: true, message: "URL not found" };
    }

    // Remove the entire <url> block
    const urlPattern = new RegExp(
      `\\s*<url>[\\s\\S]*?<loc>${postUrl.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}</loc>[\\s\\S]*?</url>`,
      "g"
    );

    sitemap = sitemap.replace(urlPattern, "");

    writeSitemap(sitemap);
    console.log(`   ✓ Post removed from sitemap\n`);

    return {
      success: true,
      url: postUrl,
    };
  } catch (error) {
    console.error(`   ✗ Failed to remove post from sitemap:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Get sitemap stats
export const getSitemapStats = () => {
  try {
    const sitemap = readSitemap();
    const urlCount = (sitemap.match(/<url>/g) || []).length;
    const lastModified = fs.statSync(SITEMAP_PATH).mtime;

    return {
      totalUrls: urlCount,
      lastModified: lastModified.toISOString(),
      path: SITEMAP_PATH,
    };
  } catch (error) {
    console.error("Error getting sitemap stats:", error.message);
    return null;
  }
};
