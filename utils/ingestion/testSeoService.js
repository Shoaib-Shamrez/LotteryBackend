// utils/ingestion/testSeoService.js
//
// Unit tests for the pure SEO template generator.

import assert from "assert";
import { generateSeoFields, GAME_NAMES } from "../../utils/seoService.js";

const cases = [
  {
    name: "take5 with both sessions",
    input: {
      category: "take5",
      date: "2026-08-17",
      middayWinningNumbers: ["05", "10", "15", "20", "25"],
      eveningWinningNumbers: ["01", "02", "03", "04", "05"]
    },
    expectMetaTitle: "New York Take 5 Winning Numbers - 2026-08-17",
    expectMetaDescriptionContains: "New York Take 5 winning numbers for 2026-08-17. Midday: 05, 10, 15, 20, 25 | Evening: 01, 02, 03, 04, 05."
  },
  {
    name: "numbers without evening",
    input: {
      category: "numbers",
      date: "2026-08-17",
      middayWinningNumbers: ["1", "2", "3"]
    },
    expectMetaTitle: "New York Daily Numbers Winning Numbers - 2026-08-17",
    expectMetaDescriptionContains: "Midday: 1, 2, 3 | Evening: N/A."
  },
  {
    name: "title provided -> title-prefixed meta title",
    input: {
      category: "lotto",
      date: "2026-08-17",
      title: "Saturday Special",
      middayWinningNumbers: ["10", "20", "30", "40", "50", "59"]
    },
    expectMetaTitle: "Saturday Special | New York Lotto",
    expectMetaDescriptionContains: "New York Lotto winning numbers"
  },
  {
    name: "unknown category falls back to title-case slug",
    input: {
      category: "something_custom",
      date: "2026-08-17"
    },
    expectMetaTitle: "Something Custom Winning Numbers - 2026-08-17",
    expectMetaDescriptionContains: "Something Custom winning numbers for 2026-08-17"
  },
  {
    name: "long description is truncated to <=160",
    input: {
      category: "powerball",
      date: "2026-08-17",
      middayWinningNumbers: ["01","02","03","04","05"],
      eveningWinningNumbers: ["11","12","13","14","15","16","17","18","19","20"]
    },
    maxLen: 160
  },
  {
    name: "empty title -> template-based meta title",
    input: {
      category: "megamillions",
      date: "2026-08-17",
      title: "   ",
      middayWinningNumbers: ["10","20","30","40","50"],
      eveningWinningNumbers: ["10","20","30","40","50","7"]
    },
    expectMetaTitleStartsWith: "Mega Millions Winning Numbers - 2026-08-17"
  }
];

function run() {
  console.log("--- SEO Service Unit Tests ---");
  for (const c of cases) {
    const out = generateSeoFields(c.input);
    assert.ok(out.metaTitle && typeof out.metaTitle === "string", `${c.name}: metaTitle missing`);
    assert.ok(out.metaDescription && typeof out.metaDescription === "string", `${c.name}: metaDescription missing`);
    if (c.expectMetaTitle) {
      assert.strictEqual(out.metaTitle, c.expectMetaTitle, `${c.name}: metaTitle mismatch`);
    }
    if (c.expectMetaTitleStartsWith) {
      assert.ok(
        out.metaTitle.startsWith(c.expectMetaTitleStartsWith),
        `${c.name}: metaTitle=${out.metaTitle} does not start with ${c.expectMetaTitleStartsWith}`
      );
    }
    if (c.expectMetaDescriptionContains) {
      assert.ok(
        out.metaDescription.includes(c.expectMetaDescriptionContains),
        `${c.name}: metaDescription missing "${c.expectMetaDescriptionContains}"`
      );
    }
    if (c.maxLen) {
      assert.ok(out.metaDescription.length <= c.maxLen,
        `${c.name}: metaDescription too long: ${out.metaDescription.length}`);
    }
    console.log(`✓ ${c.name}`);
  }

  for (const k of ["numbers","win4","take5","lotto","powerball","megamillions"]) {
    assert.ok(GAME_NAMES[k] && typeof GAME_NAMES[k] === "string", `GAME_NAMES missing ${k}`);
  }
  console.log("✓ GAME_NAMES has all categories");

  console.log("🎉 All SEO Service Unit Tests PASSED!");
  process.exit(0);
}

try {
  run();
} catch (err) {
  console.error("❌ SEO Service tests failed:", err);
  process.exit(1);
}
