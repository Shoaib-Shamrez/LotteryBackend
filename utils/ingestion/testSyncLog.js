// utils/ingestion/testSyncLog.js
import assert from "assert";
import express from "express";
import request from "supertest";
import syncRoutes from "../../routes/syncRoutes.js";

// Build an app instance for testing
const app = express();
app.use(express.json());
app.use("/api/sync", syncRoutes);

// Ensure SYNC_SECRET is set
process.env.SYNC_SECRET = process.env.SYNC_SECRET || "test-secret";

async function runTests() {
  console.log("--- Sync Log Endpoint Tests ---");

  // 1. Trigger a successful sync to generate a log entry
  const syncRes = await request(app)
    .post("/api/sync/trigger?category=take5")
    .set('Authorization', `Bearer ${process.env.SYNC_SECRET}`);
  assert.strictEqual(syncRes.status, 200, "Sync should succeed");
  const logId = syncRes.body.logId;
  assert.ok(logId, "logId must be present");

  // 2. GET logs list (authenticated)
  const listRes = await request(app)
    .get('/api/sync/logs')
    .set('Authorization', `Bearer ${process.env.SYNC_SECRET}`);
  assert.strictEqual(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body), "Response should be array");
  assert.ok(listRes.body.some(l => l.id === logId), "Created log appears in list");

  // 3. GET single log by id
  const singleRes = await request(app)
    .get(`/api/sync/logs/${logId}`)
    .set('Authorization', `Bearer ${process.env.SYNC_SECRET}`);
  assert.strictEqual(singleRes.status, 200);
  assert.strictEqual(singleRes.body.log.id, logId);

  // 4. Authentication failure (no token)
  const authFail = await request(app).get('/api/sync/logs');
  assert.strictEqual(authFail.status, 401);

  // 5. Invalid pagination parameter
  const badLimit = await request(app)
    .get('/api/sync/logs?limit=0')
    .set('Authorization', `Bearer ${process.env.SYNC_SECRET}`);
  assert.strictEqual(badLimit.status, 400);

  // 6. 404 for non‑existent log
  const notFound = await request(app)
    .get('/api/sync/logs/999999')
    .set('Authorization', `Bearer ${process.env.SYNC_SECRET}`);
  assert.strictEqual(notFound.status, 404);

  // 7. Duplicate sync creates a new logId
  const secondSync = await request(app)
    .post("/api/sync/trigger?category=take5")
    .set('Authorization', `Bearer ${process.env.SYNC_SECRET}`);
  assert.strictEqual(secondSync.status, 200);
  const secondLogId = secondSync.body.logId;
  assert.notStrictEqual(logId, secondLogId, "Each sync should produce distinct logId");

  console.log("✓ All sync‑log endpoint tests passed.");
}

runTests().catch(err => {
  console.error("❌ Sync‑log tests failed:", err);
  process.exit(1);
});
