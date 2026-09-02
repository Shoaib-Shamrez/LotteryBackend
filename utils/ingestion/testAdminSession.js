// utils/ingestion/testAdminSession.js
//
// Feature: admin browser authentication via signed HttpOnly cookie.
// Tests the real configured app (imported from server.js) — no port binding.
//
// Test environment is set BEFORE the dynamic import of server.js so that
// server.js skips .listen (NODE_ENV=test) and the cookie helper uses
// secure:false. ESM hoists static imports, so we must use a dynamic
// import to defer server.js evaluation.

process.env.NODE_ENV = "test";
process.env.SYNC_SECRET = process.env.SYNC_SECRET || "test-secret";
process.env.ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || "test-session-secret-32-chars-minimum-xyz";
process.env.ADMIN_FRONTEND_ORIGINS =
  process.env.ADMIN_FRONTEND_ORIGINS || "http://localhost:5173";

import assert from "assert";
import bcrypt from "bcrypt";
import request from "supertest";
import pool from "../../config/db.js";

const { app } = await import("../../server.js");

const TEST_ADMIN_EMAIL = "test-admin@lottery.local";
const TEST_ADMIN_PWD = "TestPass123!";
const TEST_EDITOR_EMAIL = "test-editor@lottery.local";
const TEST_EDITOR_PWD = "EditorPass123!";

async function ensureUser(email, password, name, role) {
  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  const hash = await bcrypt.hash(password, 10);
  if (rows.length > 0) {
    await pool.query(
      "UPDATE users SET password = $1, role = $2, name = $3 WHERE email = $4",
      [hash, role, name, email]
    );
    return rows[0].id;
  }
  const { rows: ins } = await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [name, email, hash, role]
  );
  return ins[0].id;
}

async function runTests() {
  console.log("--- Admin Session Cookie Auth Tests ---");

  await ensureUser(TEST_ADMIN_EMAIL, TEST_ADMIN_PWD, "Test Admin", "admin");
  await ensureUser(TEST_EDITOR_EMAIL, TEST_EDITOR_PWD, "Test Editor", "editor");

  // T1: unauthenticated GET -> 401
  {
    const r = await request(app).get("/api/admin/sync/runs");
    assert.strictEqual(r.status, 401, `expected 401 got ${r.status}`);
    console.log("✓ T1 unauthenticated request rejected");
  }

  // T2: bad credentials -> 401, no cookie
  {
    const r = await request(app)
      .post("/api/user/login")
      .send({ email: "nope@example.com", password: "wrong" });
    assert.strictEqual(r.status, 401, `expected 401 got ${r.status}`);
    assert.ok(!r.headers["set-cookie"], "no cookie should be issued");
    console.log("✓ T2 bad credentials -> 401, no cookie");
  }

  // T3: valid credentials -> 200, admin_session cookie with HttpOnly + SameSite=None
  let adminAgent = request.agent(app);
  {
    const r = await adminAgent
      .post("/api/user/login")
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PWD });
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    const setCookie = r.headers["set-cookie"] || [];
    const adminCookie = setCookie.find(c => c.startsWith("admin_session="));
    assert.ok(adminCookie, "admin_session cookie must be set");
    assert.ok(/HttpOnly/i.test(adminCookie), "cookie must be HttpOnly");
    assert.ok(/SameSite=None/i.test(adminCookie), "cookie must be SameSite=None");
    assert.ok(/Path=\//i.test(adminCookie), "cookie Path=/");
    console.log("✓ T3 valid login -> 200 with HttpOnly SameSite=None cookie");
  }

  // T4: cookie-bearing GET /api/admin/sync/runs -> 200
  {
    const r = await adminAgent.get("/api/admin/sync/runs");
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(Array.isArray(r.body.runs), "runs must be array");
    console.log(`✓ T4 cookie-authenticated request OK (${r.body.runs.length} runs)`);
  }

  // T5: editor account -> 403 (cannot manage_sync_runs)
  {
    const editorAgent = request.agent(app);
    const login = await editorAgent
      .post("/api/user/login")
      .send({ email: TEST_EDITOR_EMAIL, password: TEST_EDITOR_PWD });
    assert.strictEqual(login.status, 200);
    const r = await editorAgent.get("/api/admin/sync/runs");
    assert.strictEqual(r.status, 403, `editor should be 403 got ${r.status}`);
    console.log("✓ T5 editor -> 403 forbidden");
  }

  // T6: POST /api/user/logout -> 200, cookie cleared
  {
    const r = await adminAgent.post("/api/user/logout");
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}`);
    const setCookie = r.headers["set-cookie"] || [];
    const cleared = setCookie.find(c => c.startsWith("admin_session="));
    assert.ok(cleared, "Set-Cookie header must clear admin_session");
    assert.ok(/Max-Age=0/i.test(cleared) || /admin_session=;/i.test(cleared), "cookie must be cleared");
    console.log("✓ T6 logout clears cookie");
  }

  // T7: subsequent request fails 401
  {
    const r = await adminAgent.get("/api/admin/sync/runs");
    assert.strictEqual(r.status, 401, `expected 401 got ${r.status}`);
    console.log("✓ T7 post-logout request rejected");
  }

  // T8: tampered cookie (mutated signature) -> 401
  {
    const tmpAgent = request.agent(app);
    const login = await tmpAgent
      .post("/api/user/login")
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PWD });
    const cookieStr = (login.headers["set-cookie"] || []).find(c => c.startsWith("admin_session="));
    const cookieVal = cookieStr.split(";")[0].split("=")[1];
    const tampered = cookieVal.slice(0, -1) + (cookieVal.slice(-1) === "A" ? "B" : "A");
    const r = await request(app)
      .get("/api/admin/sync/runs")
      .set("Cookie", `admin_session=${tampered}`);
    assert.strictEqual(r.status, 401, `tampered cookie should be 401 got ${r.status}`);
    console.log("✓ T8 tampered cookie rejected");
  }

  // T9: bearer token (no cookie) is NOT accepted by adminSessionAuth
  {
    const r = await request(app)
      .get("/api/admin/sync/runs")
      .set("Authorization", `Bearer ${process.env.SYNC_SECRET}`);
    assert.strictEqual(r.status, 401, `bearer-only should be 401 got ${r.status}`);
    console.log("✓ T9 bearer-only rejected by adminSessionAuth (no fallback)");
  }

  // T10: GET /api/user/me unauthenticated -> 401
  {
    const fresh = request(app);
    const r = await fresh.get("/api/user/me");
    assert.strictEqual(r.status, 401, `expected 401 got ${r.status}`);
    console.log("✓ T10 /api/user/me unauthenticated -> 401");
  }

  // T11: GET /api/user/me with valid admin_session cookie -> 200 with correct user object
  {
    const meAgent = request.agent(app);
    await meAgent
      .post("/api/user/login")
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PWD });
    const r = await meAgent.get("/api/user/me");
    assert.strictEqual(r.status, 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.strictEqual(r.body.success, true);
    assert.ok(r.body.user, "user object must be present");
    assert.strictEqual(r.body.user.role, "admin");
    assert.strictEqual(r.body.user.email, TEST_ADMIN_EMAIL);
    assert.strictEqual(r.body.user.password, undefined, "password must not be returned");
    assert.ok(Number.isFinite(r.body.user.id), "id must be numeric");
    console.log(`✓ T11 /api/user/me authenticated -> 200 (id=${r.body.user.id}, role=${r.body.user.role})`);
  }

  console.log("🎉 All Admin Session Cookie Auth Tests PASSED!");
  await pool.end();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("❌ Admin session tests failed:", err);
  try { await pool.end(); } catch {}
  process.exit(1);
});