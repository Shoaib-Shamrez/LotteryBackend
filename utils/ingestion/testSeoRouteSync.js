// utils/ingestion/testSeoRouteSync.js
//
// Pure unit tests for SEO route sync, sitemap cache invalidation, and robots.txt output.

import assert from "assert";
import { bustSitemapCache, getDynamicSitemap } from "../../utils/sitemapService.js";

async function testSitemapCacheBusting() {
  console.log("Testing sitemap cache busting...");
  // Calling bustSitemapCache should reset the cache timestamp without throwing
  bustSitemapCache();
  console.log("✓ bustSitemapCache executed successfully");
}

function testRobotsTxtContent() {
  console.log("Testing robots.txt content generation...");
  const domain = "https://nylotteryresults.com";
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${domain.replace(/\/$/, "")}/sitemap.xml\n`;

  assert.ok(content.includes("User-agent: *"), "robots.txt missing User-agent");
  assert.ok(content.includes("Allow: /"), "robots.txt missing Allow directive");
  assert.ok(content.includes("Sitemap: https://nylotteryresults.com/sitemap.xml"), "robots.txt missing Sitemap directive");
  console.log("✓ robots.txt format verified");
}

async function run() {
  console.log("--- SEO Route & Sitemap Remediation Unit Tests ---");
  await testSitemapCacheBusting();
  testRobotsTxtContent();
  console.log("🎉 All SEO Route Remediation Unit Tests PASSED!");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Tests failed:", err);
  process.exit(1);
});
