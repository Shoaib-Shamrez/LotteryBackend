// utils/ingestion/testScheduler.js
//
// Tests for the scheduler configuration parser and the runScheduledForCategory
// lifecycle. NODE_ENV is set to "test" at the very top so any side-effect
// imports (e.g. server.js) cannot start the cron.

process.env.NODE_ENV = "test";
process.env.SYNC_SECRET = process.env.SYNC_SECRET || "test-secret";
process.env.ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || "test-session-secret-32-chars-minimum-xyz";
process.env.ADMIN_FRONTEND_ORIGINS =
  process.env.ADMIN_FRONTEND_ORIGINS || "http://localhost:5173";

import assert from "assert";
import cron from "node-cron";
import {
  parseSchedule,
  loadSchedulerConfig,
  resolveDates,
  startScheduler,
  DEFAULT_CRON,
  DEFAULT_CATEGORIES
} from "../../utils/scheduler.js";
import { runScheduledForCategory } from "../../controllers/syncRunController.js";
import pool from "../../config/db.js";

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function cleanupSchedRows() {
  // Best-effort cleanup; the test uses a date that no other test touches.
  await pool.query(
    "DELETE FROM sync_logs WHERE run_id IN (SELECT id FROM sync_runs WHERE category='take5' AND start_date='2099-01-01' AND triggered_by='scheduled')"
  );
  await pool.query(
    "DELETE FROM sync_runs WHERE category='take5' AND start_date='2099-01-01' AND triggered_by='scheduled'"
  );
}

async function run() {
  console.log("--- Scheduler Tests ---");

  // T1: parseSchedule - valid
  {
    const r = parseSchedule("0 3 * * *");
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.expression, "0 3 * * *");
    console.log("✓ T1 parseSchedule accepts a valid 5-field cron expression");
  }

  // T2: parseSchedule - invalid
  {
    const r = parseSchedule("99 99 * *");
    assert.strictEqual(r.valid, false);
    assert.ok(r.error);
    console.log("✓ T2 parseSchedule rejects an invalid expression");
  }

  // T3: parseSchedule - empty/null
  {
    const r1 = parseSchedule("");
    assert.strictEqual(r1.valid, false);
    const r2 = parseSchedule(null);
    assert.strictEqual(r2.valid, false);
    console.log("✓ T3 parseSchedule rejects empty and non-string input");
  }

  // T4: loadSchedulerConfig defaults
  {
    const cfg = loadSchedulerConfig({});
    assert.strictEqual(cfg.valid, true);
    assert.strictEqual(cfg.cron, DEFAULT_CRON);
    assert.deepStrictEqual(cfg.categories, DEFAULT_CATEGORIES);
    assert.strictEqual(cfg.dateMode, "yesterday");
    console.log(`✓ T4 loadSchedulerConfig returns sensible defaults (cron='${cfg.cron}', categories=${cfg.categories.length})`);
  }

  // T5: loadSchedulerConfig custom values
  {
    const cfg = loadSchedulerConfig({
      SYNC_SCHEDULE_CRON: "*/15 * * * *",
      SYNC_CATEGORIES: "take5, lotto",
      SYNC_SCHEDULE_DATE_MODE: "today",
      SYNC_SCHEDULE_TZ: "America/New_York"
    });
    assert.strictEqual(cfg.valid, true);
    assert.strictEqual(cfg.cron, "*/15 * * * *");
    assert.deepStrictEqual(cfg.categories, ["take5", "lotto"]);
    assert.strictEqual(cfg.dateMode, "today");
    assert.strictEqual(cfg.timezone, "America/New_York");
    console.log("✓ T5 loadSchedulerConfig respects all overrides and normalizes whitespace");
  }

  // T6: loadSchedulerConfig invalid cron
  {
    const cfg = loadSchedulerConfig({ SYNC_SCHEDULE_CRON: "not a cron" });
    assert.strictEqual(cfg.valid, false);
    assert.ok(cfg.error);
    console.log("✓ T6 loadSchedulerConfig rejects an invalid cron");
  }

  // T7: resolveDates - yesterday / today / both
  {
    const fixedNow = new Date(Date.UTC(2026, 7, 17, 12, 0, 0)); // 2026-08-17
    assert.deepStrictEqual(resolveDates("yesterday", fixedNow), ["2026-08-16"]);
    assert.deepStrictEqual(resolveDates("today", fixedNow), ["2026-08-17"]);
    assert.deepStrictEqual(resolveDates("both", fixedNow), ["2026-08-16", "2026-08-17"]);
    console.log("✓ T7 resolveDates returns expected YYYY-MM-DD list per mode");
  }

  // T8: startScheduler is a no-op when NODE_ENV=test
  {
    const ctrl = await startScheduler({ env: { NODE_ENV: "test" }, runFor: async () => null });
    const status = ctrl.status();
    assert.strictEqual(status.started, false);
    assert.strictEqual(status.running, false);
    assert.strictEqual(status.reason, "test-mode");
    await ctrl.stop();
    console.log("✓ T8 startScheduler does not start in test mode");
  }

  // T9: runScheduledForCategory creates a run row with triggered_by='scheduled'
  await cleanupSchedRows();
  {
    const date = "2099-01-01";
    const result = await runScheduledForCategory("take5", date);
    assert.ok(result, "runScheduledForCategory should return a result");
    assert.ok(result.run, "result.run should be present");
    assert.strictEqual(result.run.triggered_by, "scheduled");
    assert.strictEqual(result.run.category, "take5");
    assert.ok(result.run.start_date, "run start_date present");
    // The new run row should be present in the DB
    const { rows } = await pool.query(
      "SELECT id, triggered_by, category, start_date, end_date FROM sync_runs WHERE id = $1",
      [result.run.id]
    );
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].triggered_by, "scheduled");
    assert.strictEqual(rows[0].category, "take5");
    console.log(`✓ T9 runScheduledForCategory wrote sync_run #${result.run.id} with triggered_by=scheduled`);
  }

  // T10: failure path - engine throws -> run row has success=false and errors populated
  await cleanupSchedRows();
  {
    const date = "2099-01-01";
    // Patch the controller's internal engine by importing and replacing its
    // syncSingle. Simpler: create a run via runScheduledForCategory after
    // stubbing the engine through a direct engine.syncSingle call wrapped
    // in try/catch. Instead, use the controller's existing error path by
    // calling the internal executeRun with a category that the engine can
    // find but with a date string that causes the provider to throw.
    //
    // Cleanest approach: directly call runScheduledForCategory, then force
    // an update with success=false via a separate test path. But the spec
    // requires the engine to throw. We do that by monkey-patching the
    // imported engine module's syncSingle. Since the controller imports
    // IngestionSyncEngine by name, we re-import and swap the prototype.
    const syncModule = await import("../../utils/ingestion/sync.js");
    const original = syncModule.IngestionSyncEngine.prototype.syncSingle;
    syncModule.IngestionSyncEngine.prototype.syncSingle = async () => {
      throw new Error("simulated engine failure");
    };
    try {
      const result = await runScheduledForCategory("take5", date);
      assert.ok(result, "should still return a result");
      assert.strictEqual(result.run.success, false, "run should be marked failed");
      assert.ok(
        Array.isArray(result.run.errors) && result.run.errors.length > 0,
        "errors should be populated"
      );
      console.log(`✓ T10 engine failure -> run #${result.run.id} success=false, errors=${result.run.errors.length}`);
    } finally {
      syncModule.IngestionSyncEngine.prototype.syncSingle = original;
    }
  }

  await cleanupSchedRows();
  await pool.end();
  console.log("🎉 All Scheduler Tests PASSED!");
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Scheduler tests failed:", err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
