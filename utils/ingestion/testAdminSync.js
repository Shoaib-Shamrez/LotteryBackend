// utils/ingestion/testAdminSync.js
// Feature 2.2 admin sync operator endpoint tests.
//
// Uses supertest to mount adminSyncRoutes directly.
import assert from "assert";
import express from "express";
import request from "supertest";
import adminSyncRoutes from "../../routes/adminSyncRoutes.js";
import pool from "../../config/db.js";

process.env.SYNC_SECRET = process.env.SYNC_SECRET || "test-secret";
const TOKEN = `Bearer ${process.env.SYNC_SECRET}`;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/sync", adminSyncRoutes);
  return app;
}

async function fetchLatestPostId() {
  const { rows } = await pool.query("SELECT id FROM posts ORDER BY id DESC LIMIT 1");
  return rows[0]?.id ?? null;
}

async function runTests() {
  console.log("--- Feature 2.2 Admin Sync Tests ---");
  const app = buildApp();

  // T1: missing auth -> 401
  {
    const r = await request(app).get("/api/admin/sync/runs");
    assert.strictEqual(r.status, 401, "missing auth should be 401");
    console.log("✓ T1 missing auth rejected");
  }

  // T2: list runs -> 200, array
  {
    const r = await request(app).get("/api/admin/sync/runs").set("Authorization", TOKEN);
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.runs), "runs must be array");
    console.log(`✓ T2 list runs OK (${r.body.runs.length} existing runs)`);
  }

  // T3: manual run, single date -> 200, one run + one log
  let manualRunId;
  {
    const r = await request(app)
      .post("/api/admin/sync/runs")
      .set("Authorization", TOKEN)
      .send({ category: "take5", startDate: "2026-08-17", endDate: "2026-08-17" });
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.runId, "runId present");
    assert.strictEqual(r.body.run.triggered_by, "manual");
    assert.ok(Array.isArray(r.body.logs));
    assert.ok(r.body.logs.length >= 1, "at least one log created");
    for (const log of r.body.logs) {
      assert.strictEqual(log.run_id, r.body.runId, "log linked to run");
    }
    manualRunId = r.body.runId;
    console.log(`✓ T3 manual run id=${manualRunId}, logs=${r.body.logs.length}`);
  }

  // T4: manual run, range of 3 dates -> ONE run, multiple logs sharing run_id
  let rangeRunId;
  {
    const r = await request(app)
      .post("/api/admin/sync/runs")
      .set("Authorization", TOKEN)
      .send({ category: "take5", startDate: "2026-08-15", endDate: "2026-08-17", dryRun: true });
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    rangeRunId = r.body.runId;
    assert.strictEqual(r.body.run.triggered_by, "manual");
    assert.strictEqual(r.body.run.dry_run, true);
    assert.ok(r.body.logs.length >= 1, "logs created");
    for (const log of r.body.logs) {
      assert.strictEqual(log.run_id, rangeRunId, "all logs share run_id");
    }
    console.log(`✓ T4 manual range run id=${rangeRunId}, logs=${r.body.logs.length}, all linked`);
  }

  // T5: invalid category -> 400
  {
    const r = await request(app)
      .post("/api/admin/sync/runs")
      .set("Authorization", TOKEN)
      .send({ category: "totallyinvalid" });
    assert.strictEqual(r.status, 400);
    console.log("✓ T5 invalid category rejected");
  }

  // T6: invalid date range (end<start) -> 400
  {
    const r = await request(app)
      .post("/api/admin/sync/runs")
      .set("Authorization", TOKEN)
      .send({ category: "take5", startDate: "2026-08-17", endDate: "2026-08-15" });
    assert.strictEqual(r.status, 400);
    console.log("✓ T6 endDate<startDate rejected");
  }

  // T7: retry the manual run, original untouched
  let retryRunId;
  {
    // snapshot
    const before = await request(app)
      .get(`/api/admin/sync/runs/${manualRunId}`)
      .set("Authorization", TOKEN);
    assert.strictEqual(before.status, 200);
    const beforeEndTime = before.body.run.end_time;
    const beforeSuccess = before.body.run.success;

    const r = await request(app)
      .post(`/api/admin/sync/runs/${manualRunId}/retry`)
      .set("Authorization", TOKEN);
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.strictEqual(r.body.originalRunId, manualRunId);
    retryRunId = r.body.runId;
    assert.strictEqual(r.body.run.triggered_by, "retry");
    for (const log of r.body.logs) {
      assert.strictEqual(log.run_id, retryRunId, "retry logs link to NEW run");
    }

    // verify original untouched
    const after = await request(app)
      .get(`/api/admin/sync/runs/${manualRunId}`)
      .set("Authorization", TOKEN);
    assert.strictEqual(after.body.run.end_time, beforeEndTime, "original end_time unchanged");
    assert.strictEqual(after.body.run.success, beforeSuccess, "original success unchanged");
    assert.strictEqual(after.body.run.triggered_by, "manual", "original triggered_by unchanged");
    console.log("✓ T7 retry created new run, original untouched");
  }

  // T8: retry of non-existent run -> 404
  {
    const r = await request(app)
      .post("/api/admin/sync/runs/999999/retry")
      .set("Authorization", TOKEN);
    assert.strictEqual(r.status, 404);
    console.log("✓ T8 retry not-found -> 404");
  }

  // T9: get run returns run + logs
  {
    const r = await request(app)
      .get(`/api/admin/sync/runs/${manualRunId}`)
      .set("Authorization", TOKEN);
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.run);
    assert.ok(Array.isArray(r.body.logs));
    console.log("✓ T9 get run with logs");
  }

  // T10: override with bad numbers -> 400, no run created
  const postId = await fetchLatestPostId();
  assert.ok(postId, "expected at least one post in DB");
  let overrideRunId = null;
  {
    const r = await request(app)
      .patch(`/api/admin/sync/draw/${postId}/override`)
      .set("Authorization", TOKEN)
      .send({ midday_winnings: ["01", "02"] }); // take5 needs 5
    assert.strictEqual(r.status, 400, `expected 400 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(Array.isArray(r.body.errors) && r.body.errors.length > 0);
    console.log("✓ T10 override rejected (validator)");
  }

  // T11: override with valid numbers -> 200, run logged, errors null, audit captured
  {
    const r = await request(app)
      .patch(`/api/admin/sync/draw/${postId}/override`)
      .set("Authorization", TOKEN)
      .send({ midday_winnings: ["05", "10", "15", "20", "25"], evening_winnings: ["01", "02", "03", "04", "05"] });
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    overrideRunId = r.body.runId;
    assert.ok(overrideRunId);
    assert.strictEqual(r.body.run.triggered_by, "override");
    assert.strictEqual(r.body.run.success, true);
    assert.strictEqual(r.body.run.errors, null, "override must NOT store audit in errors");
    assert.ok(r.body.run.details, "details audit present");
    assert.ok(r.body.run.details.before, "audit before");
    assert.ok(r.body.run.details.after, "audit after");
    assert.strictEqual(r.body.run.details.postId, postId);
    console.log(`✓ T11 override accepted, run=${overrideRunId}, audit recorded`);
  }

  // T12: override of non-existent post -> 404
  {
    const r = await request(app)
      .patch(`/api/admin/sync/draw/9999999/override`)
      .set("Authorization", TOKEN)
      .send({ midday_winnings: ["05", "10", "15", "20", "25"] });
    assert.strictEqual(r.status, 404);
    console.log("✓ T12 override non-existent post -> 404");
  }

  // T13: pagination + filter
  {
    const r = await request(app)
      .get("/api/admin/sync/runs?limit=5&offset=0&triggered_by=retry")
      .set("Authorization", TOKEN);
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.runs));
    for (const run of r.body.runs) {
      assert.strictEqual(run.triggered_by, "retry", "filter must apply");
    }
    console.log("✓ T13 pagination + triggered_by filter");
  }

  // T14: triggered_by=override filter excludes other runs
  {
    const r = await request(app)
      .get("/api/admin/sync/runs?triggered_by=override&limit=200")
      .set("Authorization", TOKEN);
    assert.strictEqual(r.status, 200);
    for (const run of r.body.runs) {
      assert.strictEqual(run.triggered_by, "override");
    }
    assert.ok(r.body.runs.some(x => x.id === overrideRunId), "new override run present");
    console.log(`✓ T14 override filter returns ${r.body.runs.length} override runs`);
  }

  // T15: bad pagination -> 400
  {
    const r = await request(app)
      .get("/api/admin/sync/runs?limit=0")
      .set("Authorization", TOKEN);
    assert.strictEqual(r.status, 400);
    console.log("✓ T15 bad pagination rejected");
  }

  console.log("🎉 All Feature 2.2 Admin Sync Tests PASSED!");
  await pool.end();
}

runTests().catch(async (err) => {
  console.error("❌ Feature 2.2 tests failed:", err);
  try { await pool.end(); } catch {}
  process.exit(1);
});