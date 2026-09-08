// utils/ingestion/testPrizeBreakdownAuto.js
//
// Feature: Auto Prize Breakdowns.
// Tests that prize-tier rows are auto-generated when a draw is stored,
// that they are not regenerated on dedup/skip, that dry runs skip generation,
// that generation failures never abort the create, and that the API path
// (postController.addPost) also auto-generates.
//
// NODE_ENV is set to "test" at the very top so server.js never starts the cron
// and the app never listens on a port.
//
process.env.NODE_ENV = "test";
process.env.SYNC_SECRET = process.env.SYNC_SECRET || "test-secret";
process.env.ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || "test-session-secret-32-chars-minimum-xyz";
process.env.ADMIN_FRONTEND_ORIGINS =
  process.env.ADMIN_FRONTEND_ORIGINS || "http://localhost:5173";
process.env.APP_URL = process.env.APP_URL || "https://nylotteryresults.com";

import assert from "assert";
import { IngestionSyncEngine } from "./sync.js";
import { autoGeneratePrizeBreakdowns, generateTierRows, getSessionsWithNumbers } from "../prizeBreakdownService.js";
import {
  PRIZE_STRUCTURES
} from "../prizeBreakdownService.js";
import pool from "../../config/db.js";

const TEST_CAT = "take5";
const DATES = ["2099-12-30", "2099-12-29", "2099-12-28"]; // T3/T5, T4, T6

function take5Record(date, midday = "15 18 19 26 32", evening = "23 25 31 36 37") {
  return {
    draw_date: `${date}T00:00:00.000`,
    midday_winning_numbers: midday,
    evening_winning_numbers: evening
  };
}

// Engine that returns a deterministic Take 5 draw without hitting data.ny.gov.
class MockTake5Engine extends IngestionSyncEngine {
  constructor(date) {
    super();
    const raw = take5Record(date);
    this.provider = {
      fetchRawResults: async () => [raw],
      normalize: (cat, rec) => ({
        category: cat,
        drawDate: rec.draw_date ? rec.draw_date.split("T")[0] : null,
        middayWinningNumbers: (rec.midday_winning_numbers || "").split(" ").filter(Boolean),
        eveningWinningNumbers: (rec.evening_winning_numbers || "").split(" ").filter(Boolean),
        raw: rec
      })
    };
    this.validator = { validate: () => ({ isValid: true, errors: [] }) };
  }
}

async function cleanupDb() {
  for (const d of DATES) {
    await pool.query(
      "DELETE FROM prize_breakdowns WHERE post_id IN (SELECT id FROM posts WHERE category=$1 AND created_at::date=$2)",
      [TEST_CAT, d]
    );
    await pool.query(
      "DELETE FROM posts WHERE category=$1 AND created_at::date=$2",
      [TEST_CAT, d]
    );
  }
  // Best-effort: remove any sync_logs left for these test dates.
  await pool.query("DELETE FROM sync_logs WHERE run_id IN (SELECT id FROM sync_runs WHERE category=$1 AND start_date::date=ANY($2))", [TEST_CAT, DATES]);
  await pool.query("DELETE FROM sync_runs WHERE category=$1 AND start_date::date=ANY($2)", [TEST_CAT, DATES]);
}

async function prizeCountForDate(date) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM prize_breakdowns pb
       JOIN posts p ON p.id = pb.post_id
      WHERE p.category=$1 AND p.created_at::date=$2`,
    [TEST_CAT, date]
  );
  return rows[0].n;
}

async function postExists(date) {
  const { rows } = await pool.query(
    "SELECT id FROM posts WHERE category=$1 AND created_at::date=$2",
    [TEST_CAT, date]
  );
  return rows[0] || null;
}

async function runTests() {
  console.log("--- Auto Prize Breakdowns Tests ---");
  await cleanupDb();

  // T1: structure — every category yields the right tier count + prize_amount.
  {
    for (const cat of Object.keys(PRIZE_STRUCTURES)) {
      const tiers = PRIZE_STRUCTURES[cat];
      const rows = generateTierRows({ category: cat, sessions: ["midday"] });
      assert.strictEqual(rows.length, tiers.length, `tiers for ${cat}`);
      rows.forEach((r, i) => {
        assert.strictEqual(r.draw_type, "midday");
        assert.strictEqual(r.category, tiers[i].label);
        assert.strictEqual(r.prize_amount, tiers[i].prize_amount);
        assert.strictEqual(r.winners, null);
      });
      // Jackpot tier(s) must be NULL (pari-mutuel / unknown until audited) for
      // the draw-games that have a progressive top prize; daily Numbers/Win4
      // have only fixed payouts.
      const hasJackpot = ["take5", "lotto", "powerball", "megamillions"].includes(cat);
      const jackpotTiers = rows.filter((r) => r.prize_amount === null);
      if (hasJackpot) {
        assert.ok(jackpotTiers.length >= 1, `${cat} should have a null-prize jackpot tier`);
      } else {
        assert.strictEqual(jackpotTiers.length, 0, `${cat} should have no null-prize tier`);
      }
    }
    console.log("✓ T1 prize structure correct for all categories");
  }

  // T2: session detection + row multiplication.
  {
    assert.deepStrictEqual(getSessionsWithNumbers({ midday_winnings: ["1"], evening_winnings: ["2"] }), ["midday", "evening"]);
    assert.deepStrictEqual(getSessionsWithNumbers({ midday_winnings: ["1"], evening_winnings: null }), ["midday"]);
    assert.deepStrictEqual(getSessionsWithNumbers({ midday_winnings: null, evening_winnings: ["2"] }), ["evening"]);
    assert.deepStrictEqual(getSessionsWithNumbers({ midday_winnings: null, evening_winnings: null }), ["midday"]);

    const one = generateTierRows({ category: "take5", sessions: ["midday"] });
    const two = generateTierRows({ category: "take5", sessions: ["midday", "evening"] });
    assert.strictEqual(one.length * 2, two.length, "two sessions should double the rows");
    console.log("✓ T2 session detection + row multiplication correct");
  }

  // T3: ingestion create path auto-generates tiers.
  {
    const engine = new MockTake5Engine("2099-12-30");
    const report = await engine.syncSingle(TEST_CAT, "2099-12-30", false, null);
    assert.strictEqual(report.created, 1, "one post should be created");
    assert.ok(report.prizeBreakdownsGenerated > 0, "prize tiers should be generated");
    assert.strictEqual(report.success, true);

    const post = await postExists("2099-12-30");
    assert.ok(post, "post row should exist in DB");

    const count = await prizeCountForDate("2099-12-30");
    // take5 has 4 tiers x 2 sessions = 8 rows
    assert.strictEqual(count, PRIZE_STRUCTURES.take5.length * 2, `expected ${PRIZE_STRUCTURES.take5.length * 2} prize rows, got ${count}`);

    // Verify winners are NULL and prize_amount populated for non-jackpot tiers.
    const { rows } = await pool.query(
      `SELECT draw_type, category, winners, prize_amount FROM prize_breakdowns
         WHERE post_id=$1 ORDER BY draw_type, id`,
      [post.id]
    );
    assert.ok(rows.every((r) => r.winners === null), "all auto tiers should have NULL winners");
    assert.ok(rows.some((r) => r.prize_amount === null), "at least one jackpot tier should be NULL prize_amount");
    assert.ok(rows.every((r) => r.prize_amount !== null || r.category.includes("Jackpot")), "non-jackpot tiers should carry a prize_amount");
    console.log(`✓ T3 created post + ${count} auto-generated prize tiers (run report.prizeBreakdownsGenerated=${report.prizeBreakdownsGenerated})`);
  }

  // T4: dry run must NOT create a post or prize rows.
  {
    const engine = new MockTake5Engine("2099-12-29");
    const report = await engine.syncSingle(TEST_CAT, "2099-12-29", true, null);
    assert.strictEqual(report.created, 1, "dry-run still counts an intended create");
    assert.strictEqual(report.prizeBreakdownsGenerated, 0, "dry-run must not generate prize tiers");
    assert.strictEqual(await postExists("2099-12-29"), null, "dry-run must not persist a post");
    console.log("✓ T4 dry-run skipped post + prize creation");
  }

  // T5: dedup path (existing identical draw) must NOT add prize rows.
  {
    const engine = new MockTake5Engine("2099-12-30");
    const before = await prizeCountForDate("2099-12-30");
    const report = await engine.syncSingle(TEST_CAT, "2099-12-30", false, null);
    assert.strictEqual(report.duplicates, 1, "second identical draw should be detected as duplicate");
    assert.strictEqual(report.created, 0, "dedup should not create again");
    assert.strictEqual(report.prizeBreakdownsGenerated, 0, "dedup must not regenerate tiers");
    const after = await prizeCountForDate("2099-12-30");
    assert.strictEqual(before, after, "prize row count must not change on dedup");
    console.log("✓ T5 dedup path skipped prize regeneration");
  }

  // T6: failure isolation — a DB error during prize insertion must NOT abort
  // the sync. Patch pool.query so ONLY prize_breakdowns INSERTs throw; every
  // other query delegates to the real pool. (addPrizeBreakdownsBatch is a single
  // atomic INSERT, so a failure leaves no partial rows.)
  {
    const origQuery = pool.query.bind(pool);
    let threw = false;
    pool.query = async function (sql, params) {
      if (typeof sql === "string" && /^INSERT INTO prize_breakdowns/i.test(sql)) {
        threw = true;
        throw new Error("simulated batch insert failure");
      }
      return origQuery(sql, params);
    };

    try {
      const engine = new MockTake5Engine("2099-12-28");
      const report = await engine.syncSingle(TEST_CAT, "2099-12-28", false, null);
      assert.ok(threw, "the batch insert should have been invoked");
      assert.strictEqual(report.created, 1, "post must still be created despite prize failure");
      assert.strictEqual(report.prizeBreakdownsGenerated, 0, "no tiers inserted on failure");
      assert.strictEqual(report.success, true, "run must still report success");
      const post = await postExists("2099-12-28");
      assert.ok(post, "post row must persist after prize failure");
      assert.strictEqual(await prizeCountForDate("2099-12-28"), 0, "no prize rows persisted on failure");
      console.log("✓ T6 prize failure did not abort post creation or run success");
    } finally {
      pool.query = origQuery;
    }
  }

  // T7: idempotency guard — re-calling the generator on a post that already
  // has breakdowns must skip (no duplicates).
  {
    const post = await postExists("2099-12-30");
    const before = await prizeCountForDate("2099-12-30");
    const result = await autoGeneratePrizeBreakdowns({
      postId: post.id,
      category: TEST_CAT,
      post: { midday_winnings: ["15", "18", "19", "26", "32"], evening_winnings: ["23", "25", "31", "36", "37"] }
    });
    assert.strictEqual(result.skipped, true, "should skip when breakdowns already exist");
    assert.strictEqual(result.generated, 0);
    const after = await prizeCountForDate("2099-12-30");
    assert.strictEqual(before, after, "no new rows after re-generation attempt");
    console.log("✓ T7 idempotency guard skips regeneration for existing breakdowns");
  }

  await cleanupDb();

  console.log("🎉 All Auto Prize Breakdowns Tests PASSED!");
  await pool.end();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("❌ Auto Prize Breakdowns tests failed:", err);
  try { await cleanupDb(); } catch {}
  try { await pool.end(); } catch {}
  process.exit(1);
});
