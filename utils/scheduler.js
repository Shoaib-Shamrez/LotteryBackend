// utils/scheduler.js
//
// Cron-based scheduler for automated sync runs.
//
// The scheduler NEVER creates sync_runs or sync_logs rows itself. It calls
// `runScheduledForCategory(category, date)` from the controller layer which
// owns the entire run lifecycle (createSyncRun -> engine.syncSingle ->
// updateSyncRun). This keeps all sync_runs writes funnelled through one
// owner regardless of the trigger source (manual, retry, override, scheduled).
//
// The scheduler is a no-op when NODE_ENV === "test" so test suites can
// import server.js without starting background work.

import cron from "node-cron";
import pool from "../config/db.js";

export const DEFAULT_CRON = "0 3 * * *";
export const DEFAULT_CATEGORIES = [
  "take5",
  "lotto",
  "powerball",
  "megamillions",
  "numbers",
  "win4"
];
export const DEFAULT_DATE_MODE = "yesterday";
const RETRY_DELAY_MS = 30 * 1000;

/**
 * Validate a cron expression. Returns {valid, expression, error?}.
 * Re-uses node-cron's internal validator.
 */
export function parseSchedule(cronExpr) {
  if (typeof cronExpr !== "string" || cronExpr.trim() === "") {
    return { valid: false, error: "Cron expression must be a non-empty string" };
  }
  const expr = cronExpr.trim();
  if (!cron.validate(expr)) {
    return { valid: false, error: `Invalid cron expression: '${expr}'` };
  }
  return { valid: true, expression: expr };
}

/**
 * Resolve and validate scheduler config from an env object.
 * Falls back to defaults for any missing key.
 */
export function loadSchedulerConfig(env = process.env) {
  const cronExprRaw = env.SYNC_SCHEDULE_CRON;
  const cronResult = parseSchedule(cronExprRaw == null || cronExprRaw === "" ? DEFAULT_CRON : cronExprRaw);
  if (!cronResult.valid) {
    return { valid: false, error: cronResult.error };
  }

  let categories = DEFAULT_CATEGORIES;
  if (env.SYNC_CATEGORIES && typeof env.SYNC_CATEGORIES === "string" && env.SYNC_CATEGORIES.trim() !== "") {
    categories = env.SYNC_CATEGORIES
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  if (categories.length === 0) {
    return { valid: false, error: "SYNC_CATEGORIES resolved to an empty list" };
  }

  const dateMode = (env.SYNC_SCHEDULE_DATE_MODE || DEFAULT_DATE_MODE).toLowerCase();
  if (!["yesterday", "today", "both"].includes(dateMode)) {
    return { valid: false, error: `Invalid SYNC_SCHEDULE_DATE_MODE: '${dateMode}'` };
  }

  const timezone = (env.SYNC_SCHEDULE_TZ || "").trim() || undefined;

  return {
    valid: true,
    cron: cronResult.expression,
    categories,
    dateMode,
    timezone
  };
}

/**
 * Resolve the list of calendar dates to attempt for a given mode.
 * Uses UTC date arithmetic to avoid server-local DST drift.
 */
export function resolveDates(dateMode, now = new Date()) {
  const todayUtc = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
  ));
  const toYmd = (d) => d.toISOString().slice(0, 10);
  if (dateMode === "today") return [toYmd(todayUtc)];
  if (dateMode === "both") {
    const yesterday = new Date(todayUtc);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return [toYmd(yesterday), toYmd(todayUtc)];
  }
  // default: yesterday
  const yesterday = new Date(todayUtc);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return [toYmd(yesterday)];
}

/**
 * Internal: one tick body. For each category and each resolved date,
 * call runScheduledForCategory. Logs outcomes. Never throws.
 */
async function runTick({ categories, dateMode, runFor }) {
  const dates = resolveDates(dateMode);
  console.log(`[Scheduler] tick: categories=${categories.join(",")} dates=${dates.join(",")}`);
  for (const category of categories) {
    for (const date of dates) {
      try {
        const result = await runFor(category, date);
        if (!result) {
          console.warn(`[Scheduler] runFor returned null for ${category}/${date}`);
          continue;
        }
        const runId = result.run?.id;
        const ok = result.run?.success;
        console.log(`[Scheduler] OK cat=${category} date=${date} runId=${runId} success=${ok}`);
      } catch (err) {
        console.error(`[Scheduler] FAIL cat=${category} date=${date}:`, err.message);
      }
    }
  }
}

/**
 * Start the scheduler. Returns a control object with status() and stop().
 *
 * Behavior:
 *   - No-op in NODE_ENV=test (returns a stopped status immediately).
 *   - Performs a lightweight `SELECT 1` against the configured pool before
 *     registering the cron. Retries every RETRY_DELAY_MS until the DB is
 *     reachable. Does NOT block the caller.
 *   - Includes a `running` overlap guard. If a tick is still executing when
 *     the next cron fires, the new tick is logged and skipped.
 *   - All errors are caught and logged; nothing is allowed to crash the
 *     caller.
 */
export async function startScheduler({ runFor, env = process.env, poll = pool } = {}) {
  const isTest = (env.NODE_ENV || process.env.NODE_ENV) === "test";
  if (isTest) {
    return { started: false, status: () => ({ running: false, started: false, reason: "test-mode" }), stop: async () => {} };
  }

  const cfg = loadSchedulerConfig(env);
  if (!cfg.valid) {
    console.error(`[Scheduler] config invalid: ${cfg.error}`);
    return { started: false, status: () => ({ running: false, started: false, reason: cfg.error }), stop: async () => {} };
  }

  let task = null;
  let running = false;
  let started = false;
  let lastError = null;

  async function tryStartCron() {
    try {
      await poll.query("SELECT 1");
    } catch (err) {
      lastError = err.message;
      console.error(`[Scheduler] DB not ready: ${err.message}. Retrying in ${RETRY_DELAY_MS / 1000}s.`);
      setTimeout(tryStartCron, RETRY_DELAY_MS).unref?.();
      return;
    }
    task = cron.schedule(cfg.cron, async () => {
      if (running) {
        console.warn("[Scheduler] previous tick still running; skipping this tick");
        return;
      }
      running = true;
      try {
        await runTick({ categories: cfg.categories, dateMode: cfg.dateMode, runFor });
      } catch (err) {
        console.error("[Scheduler] tick failed:", err.message);
      } finally {
        running = false;
      }
    }, { timezone: cfg.timezone });
    task.start();
    started = true;
    console.log(
      `[Scheduler] started: cron='${cfg.cron}' tz=${cfg.timezone || "server-local"} ` +
      `categories=${cfg.categories.join(",")} dateMode=${cfg.dateMode}`
    );
  }

  // Fire-and-forget; do not await the DB check.
  tryStartCron().catch((err) => {
    console.error("[Scheduler] failed to start:", err.message);
  });

  return {
    started: false, // becomes true once the DB check completes successfully
    status: () => ({ running, started, cron: cfg.cron, categories: cfg.categories, lastError }),
    stop: async () => {
      if (task) {
        task.stop();
        task.destroy?.();
        task = null;
        started = false;
        console.log("[Scheduler] stopped");
      }
    }
  };
}
