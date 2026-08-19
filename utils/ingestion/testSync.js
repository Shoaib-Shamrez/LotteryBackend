import assert from "assert";
import { NYOpenDataProvider } from "./provider.js";
import { IngestionValidator } from "./validator.js";
import { syncAuthMiddleware } from "../../middleware/syncAuth.js";
import { IngestionSyncEngine } from "./sync.js";
import syncRoutes from "../../routes/syncRoutes.js";
import crypto from "crypto";

// --- MOCK SYSTEM FOR TESTING ---
const mockRequest = (headers = {}, env = {}) => {
  process.env.SYNC_SECRET = env.SYNC_SECRET;
  return {
    headers,
  };
};

const mockResponse = () => {
  const res = {
    statusVal: 200,
    jsonVal: null,
    status(code) {
      this.statusVal = code;
      return this;
    },
    json(obj) {
      this.jsonVal = obj;
      return this;
    }
  };
  return res;
};

// --- RUN TESTS ---
async function runTests() {
  console.log("-----------------------------------------");
  console.log("🏃 Running Feature 1.1 Ingestion Tests...");
  console.log("-----------------------------------------");

  const provider = new NYOpenDataProvider();
  const validator = new IngestionValidator();

  // Test 1: Normalization (Take 5)
  console.log("Test 1: Normalizing Take 5 SODA response...");
  const rawTake5 = {
    draw_date: "2026-08-17T00:00:00.000",
    midday_winning_numbers: "15 18 19 26 32",
    evening_winning_numbers: "23 25 31 36 37"
  };
  const normalizedTake5 = provider.normalize("take5", rawTake5);
  assert.strictEqual(normalizedTake5.drawDate, "2026-08-17");
  assert.deepStrictEqual(normalizedTake5.middayWinningNumbers, ["15", "18", "19", "26", "32"]);
  assert.deepStrictEqual(normalizedTake5.eveningWinningNumbers, ["23", "25", "31", "36", "37"]);
  console.log("✓ Take 5 Normalization passed.");

  // Test 2: Normalization (Lotto)
  console.log("Test 2: Normalizing Lotto SODA response...");
  const rawLotto = {
    draw_date: "2026-08-15T00:00:00.000",
    winning_numbers: "06 07 23 25 36 37",
    bonus: "32"
  };
  const normalizedLotto = provider.normalize("lotto", rawLotto);
  assert.deepStrictEqual(normalizedLotto.middayWinningNumbers, ["06", "07", "23", "25", "36", "37", "Bonus: 32"]);
  console.log("✓ Lotto Normalization passed.");

  // Test 3: Normalization (Powerball)
  console.log("Test 3: Normalizing Powerball SODA response...");
  const rawPB = {
    draw_date: "2026-08-17T00:00:00.000",
    winning_numbers: "08 15 25 49 65 22",
    multiplier: "4"
  };
  const normalizedPB = provider.normalize("powerball", rawPB);
  assert.deepStrictEqual(normalizedPB.middayWinningNumbers, ["08", "15", "25", "49", "65", "Powerball: 22", "Powerplay: 4"]);
  console.log("✓ Powerball Normalization passed.");

  // Test 4: Validation rules (Take 5 valid)
  console.log("Test 4: Validating correct Take 5...");
  const validation1 = validator.validate(normalizedTake5);
  assert.strictEqual(validation1.isValid, true);
  console.log("✓ Take 5 Validation passed.");

  // Test 5: Validation rules (Lotto invalid main numbers count)
  console.log("Test 5: Validating Lotto with wrong number count...");
  const invalidLotto = {
    category: "lotto",
    drawDate: "2026-08-15",
    middayWinningNumbers: ["06", "07", "23", "25", "36", "Bonus: 32"] // only 5 main numbers
  };
  const validation2 = validator.validate(invalidLotto);
  assert.strictEqual(validation2.isValid, false);
  assert.ok(validation2.errors.some(err => err.includes("must have exactly 6 main numbers")));
  console.log("✓ Lotto invalid count validation passed.");

  // Test 6: Security middleware check (Unauthorized)
  console.log("Test 6: Testing syncAuthMiddleware with missing header...");
  const req1 = mockRequest({}, { SYNC_SECRET: "test-secret" });
  const res1 = mockResponse();
  let nextCalled1 = false;
  syncAuthMiddleware(req1, res1, () => { nextCalled1 = true; });
  assert.strictEqual(res1.statusVal, 401);
  assert.strictEqual(res1.jsonVal.error, "Unauthorized");
  assert.strictEqual(nextCalled1, false);
  console.log("✓ Middleware rejected missing auth header.");

  // Test 7: Security middleware check (Authorized)
  console.log("Test 7: Testing syncAuthMiddleware with correct bearer token...");
  const req2 = mockRequest({ authorization: "Bearer test-secret" }, { SYNC_SECRET: "test-secret" });
  const res2 = mockResponse();
  let nextCalled2 = false;
  syncAuthMiddleware(req2, res2, () => { nextCalled2 = true; });
  assert.strictEqual(nextCalled2, true);
  console.log("✓ Middleware authorized correct token.");

  // Test 9: Engine handles empty provider result and returns durationMs
  console.log("Test 9: Handling empty provider result...");
  class MockEmptyEngine extends IngestionSyncEngine {
    constructor() {
      super();
      // Override provider to return empty array
      this.provider = {
        fetchRawResults: async () => []
      };
    }
  }
  const emptyEngine = new MockEmptyEngine();
  const emptyReport = await emptyEngine.sync("numbers");
  assert.strictEqual(emptyReport.fetched, 0);
  assert.ok(typeof emptyReport.durationMs === "number" && emptyReport.durationMs >= 0);
  console.log("✓ Empty provider handling passed.");

  // Test 10: DurationMs on normal sync
  console.log("Test 10: DurationMs on normal sync...");
  class MockNormalEngine extends IngestionSyncEngine {
    constructor() {
      super();
      this.provider = {
        fetchRawResults: async () => [{ draw_date: "2026-08-17T00:00:00.000", midday_winning_numbers: "01 02 03 04 05" }]
      };
      this.validator = {
        validate: () => ({ isValid: true })
      };
    }
  }
  const normalEngine = new MockNormalEngine();
  const normalReport = await normalEngine.sync("take5");
  assert.strictEqual(normalReport.fetched, 1);
  assert.ok(typeof normalReport.durationMs === "number" && normalReport.durationMs >= 0);
  console.log("✓ DurationMs on normal sync passed.");

  // Test 11: Invalid category handling via syncRoutes (should 400)
  console.log("Test 11: Invalid category request returns 400...");
  const express = await import("express");
  const app = express.default();
  app.use(express.default.json());
  app.use("/api/sync", syncRoutes);
  const request = await import("supertest");
  const resInvalid = await request.default(app).post("/api/sync/trigger?category=invalidcat");
  assert.strictEqual(resInvalid.status, 400);
  console.log("✓ Invalid category rejection passed.");

  // Test 12: Invalid date format handling (should 400)
  console.log("Test 12: Invalid date format returns 400...");
  const resBadDate = await request.default(app).post("/api/sync/trigger?category=numbers&date=2023-02-30");
  assert.strictEqual(resBadDate.status, 400);
  console.log("✓ Invalid date rejection passed.");

  // Test 13: Invalid dryRun value handling (should 400)
  console.log("Test 13: Invalid dryRun value returns 400...");
  const resBadDry = await request.default(app).post("/api/sync/trigger?category=numbers&dryRun=maybe");
  assert.strictEqual(resBadDry.status, 400);
  console.log("✓ Invalid dryRun rejection passed.");

  console.log("-----------------------------------------");
  console.log("🎉 All Feature 1.1 Ingestion Tests PASSED!");
  console.log("-----------------------------------------");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
