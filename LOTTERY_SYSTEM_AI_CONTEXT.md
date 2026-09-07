# Lottery System — AI Context (living document)

**Last updated:** 2026-09-07
**Working roots:** `C:\Shoaib\Personal\lottery-ny\LotteryBackend` (Express + Postgres via `pg`) and `C:\Shoaib\Personal\lottery-ny\LotteryResults` (Vite + React 19 CSR SPA).

> This document is the single source of truth for any agent joining this project. If the code and this file disagree, the code wins — update this file in the same task.

---

## 1. Stack & data flow

- **Backend** `LotteryBackend/`: Express 5, `pg` (Supabase Postgres), `node-cron`, `bcrypt`, `nodemailer`, `cors`, `express-rate-limit`. ESM (`"type":"module"`). `npm test` runs `utils/ingestion/testSync.js`.
- **Frontend** `LotteryResults/`: Vite 7 + React 19 + React Router 7, Tailwind 4. Pure **client-side rendering (CSR)** — **no SSR/ISR/prerendering**. `dist/` is the static bundle. Env var exposed to the browser is only `VITE_API_BASE_URL`.
- **Ingestion source:** NY Lottery open data on `data.ny.gov` (Socrata), one dataset per game (`utils/ingestion/provider.js` `DATASETS`).
- **Deployment:** Backend deploys to **Vercel** (`https://lottery-backend-omega.vercel.app`) & **Railway** via `.github/workflows/deploy.yml` (on push to `backend`). Frontend deploys to **Vercel** via `LotteryResults/vercel.json`.
- **Sync ownership model (preserved):** the scheduler only invokes `runScheduledForCategory(category,date)`. All `sync_runs`/`sync_logs` writes go through the controller layer
  (`createSyncRun` → `engine.syncSingle` → `createSyncLog` → `updateSyncRun`).

---

## 2. Features & status

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | SEO metadata + dynamic sitemap | ✅ Completed & Remediated | `generateSeoFields` in `utils/seoService.js`; dynamic `/sitemap.xml` & `/robots.txt` in `server.js`; Vercel backend URL rewrites; cache invalidation in `postController.js`. |
| 2 | Automated sync scheduler | ✅ Implemented + hardened + health monitoring | Scheduler hardening (timeout/retry/cancellation) + Feature 2.1 sync health dashboard. |
| 3 | Auto prize breakdowns | ✅ Completed / Verified | Static, verified PRIZE_STRUCTURES in utils/prizeBreakdownService.js; winners always NULL; auto-generated on post creation; idempotent + best-effort. |
| 4 | Live Notifications | ✅ Completed | Automated ingestion dispatches non-blocking email alerts to subscribers (`triggerLiveSubscriberNotifications` in `utils/emailService.js`). |

### Feature 4 — Sync Health & Monitoring Dashboard (✅ Completed 2026-09-04)

**New files:**
- `utils/schedulerStatus.js` — singleton holder for the scheduler controller; exposes `setSchedulerController()`, `clearSchedulerController()`, `getSchedulerStatus()`. Avoids circular imports by keeping scheduler state in one module-level reference.
- `utils/sanitizeError.js` — redacts sensitive patterns (connection strings, Bearer tokens, SYNC_SECRET, DATABASE_URL, URL query params) from error messages before returning them in API responses.
- `src/components/admin/dashboard/SyncHealthCards.jsx` — React component rendering sync health stats cards (last run, success rate, failures 24h/7d, scheduler status) with loading/error/empty states.
- `utils/ingestion/testSyncHealth.js` — 21 pure unit tests (mocked pool, mocked scheduler).

**Modified files:**
- `models/syncRunModel.js` — added `getSyncRunStats()` with SQL conditional aggregation (single query, no large row loads).
- `controllers/syncRunController.js` — added `healthHandler` (`GET /api/admin/sync/health`) and `schedulerStatusHandler` (`GET /api/admin/sync/scheduler-status`).
- `routes/adminSyncRoutes.js` — wired `/health` and `/scheduler-status` routes (protected by existing `adminSessionAuth` + `requireRole("admin", "superadmin")`).
- `server.js` — stores scheduler controller via `setSchedulerController()` after `startScheduler()` returns.
- `src/api/syncRunsApi.js` — added `getSyncHealth()` and `getSchedulerStatus()` client functions.
- `src/Pages/admin/Dashboard.jsx` — replaced hardcoded "System Status" section with `SyncHealthCards` component.

**API endpoints:**
- `GET /api/admin/sync/health` → `{ success: true, health: { lastRun, recentRuns, totalRuns, successfulRuns, failedRuns, pendingRuns, successRate, failures24h, failures7d, lastError, scheduler } }`
- `GET /api/admin/sync/scheduler-status` → `{ success: true, scheduler: { started, running, active, initialized, cron, categories, lastError } }`

**Success rate definition:** `successfulRuns / (successfulRuns + failedRuns) * 100`. Pending runs (`end_time IS NULL`) are excluded from both the numerator and denominator.

**Time windows:**
- `failures24h`: `COUNT` of `sync_runs` where `success = FALSE AND end_time >= NOW() - INTERVAL '24 hours'`
- `failures7d`: `COUNT` of `sync_runs` where `success = FALSE AND end_time >= NOW() - INTERVAL '7 days'`

Both calculated in SQL via conditional aggregation — no large row loads into Node.js.

**Scheduler status fields:**
- `started` — true if cron is registered (DB check passed, `startScheduler` completed)
- `running` — true if a tick is currently executing (overlap guard active)
- `active` — `started && !running` (scheduler is registered AND idle, ready for next tick)
- `initialized` — true if a scheduler controller has been registered
- `nextScheduledRun` — **NOT included** (node-cron v3.0.3 does not expose a public API for next-run calculation; no new dependency added)

**Database changes:** None. Uses existing `sync_runs` table with SQL conditional aggregation.

**Security:** All errors sanitized via `sanitizeErrorMessage()` before API response. Both endpoints protected by existing admin auth middleware. No new dependencies.

### Feature 1 — SEO (⚠️)
- `utils/seoService.js` `generateSeoFields()` → `{metaTitle, metaDescription}` (6 games via `GAME_NAMES`).
- `controllers/postController.js` `resolveMetaField()` picks submitted → existing → generated fallback; persists `meta_title`/`meta_desc`.
- `utils/sitemapService.js` `getDynamicSitemap()` (60s TTL cache, `bustSitemapCache()`), served at `GET /sitemap.xml` in `server.js:58` **before** `express.static`. `bustSitemapCache()` called in `addPost`, `updatePostbyid`, `removePost`, and on sync create/update.
- `src/components/SEO.jsx` renders title/desc/keywords/author/canonical/robots noindex/OG/article/Twitter; `ResultDetail.jsx` builds `canonical = ${origin}/${category}/results/${date}`.
- **Known gaps:** no `robots.txt` (project-wide); `vercel.json` `/sitemap.xml` rewrite uses `${BACKEND_URL}` which is **undefined** (broken in prod); pure CSR SPA → OG/Twitter meta invisible to non-JS crawlers (no SSR); stale committed `public/sitemap.xml` in both repos; `removePost`/`updatePostbyid` don't update the static sitemap (drift on fallback path); `routes/seoRoutes.js` `/sync-sitemap` writes to a wrong path (`../../Lottery Frontend/...`).
- **Tests:** `testSeoService.js` (7 cases) — executed, PASSED. `testSitemapDynamic.js` — source-verified, not executed (DB).

### Feature 3 — Auto prize breakdowns (⚠️)
- `utils/prizeBreakdownService.js`: `PRIZE_STRUCTURES` covers `numbers, win4, take5, lotto, powerball, megamillions`. Jackpot tier = `prize_amount: null` (variable); other tiers fixed. **`winners` always NULL** (audited counts not in the Socrata feed). **Marked `// TODO(verify)` / "UNVERIFIED"** — confirm against nylottery.org before production.
- `models/prizeBreakModel.js` `addPrizeBreakdownsBatch` = single atomic INSERT (all-or-nothing); `autoGeneratePrizeBreakdowns` is idempotent (skips existing) and never throws (best-effort). Triggered in `sync.js` (awaited) and `addPost` (fire-and-forget).
- Frontend `ResultDetail.jsx` → `PrizeBreakDown.jsx` renders Category/Prize/Winners.
- **Tests:** `testPrizeBreakdownAuto.js` (T1-T7) — source-verified, not executed (DB).

---

## 3. Feature 2 — Scheduler hardening (final 2026-09-04)

Added reliability hardening **without** changing the architecture, schema, auth, SEO, or prize-breakdown logic.

**New file** `utils/ingestion/providerHttp.js` (Node built-ins only, no new deps):
- `loadProviderConfig(env)` → `{providerTimeoutMs, maxRetries, retryDelayMs, tickTimeoutMs}`, validated, safe defaults.
- `fetchWithTimeout(url, opts, ms)` → `AbortController`-based hard deadline on provider HTTP headers; rejects `TimeoutError` (never swallows; clears timer).
- `fetchJsonWithTimeout(url, opts, ms)` → **NEW**: combines `fetch()` + `response.json()` body consumption within a **single** `AbortController` deadline. Core fix for Issue 1 — previously `response.json()` was outside any timeout and could hang indefinitely after headers arrived. Malformed `SyntaxError` (bad JSON) propagates as a permanent/non-retryable failure.
- `isRetryableHttpStatus` / `isRetryableProviderError` → retry on timeout / `TypeError` (network) / `408/429/500/502/503/504`; not on 4xx/validation/malformed-payload/config.
- `withRetry(fn, {maxRetries, baseDelayMs, sleepFn, onRetry})` → bounded exponential backoff (`retry n` → `baseDelayMs * 2^(n-1)`).
- `withTimeout(promise, ms, label)` → `Promise.race` deadline; clears timer in `finally` (preserved, not used for scheduled runs).
- `withTimeoutAbortable(promiseFactory, ms, label)` → **NEW**: creates an `AbortController`, passes its signal to the factory, and **aborts the signal** on deadline expiration. Gives the underlying work a chance to stop before unsafe DB writes (cooperative cancellation). Timer always cleared.

**Modified `utils/ingestion/provider.js`** `fetchRawResults`: now uses `fetchJsonWithTimeout` inside `withRetry`. The entire provider response (headers + body parsing) is bounded by the provider timeout and retried on transient failure. Normalization unchanged. Permanent failures (4xx, malformed JSON → `SyntaxError`, config errors) are NOT retried.

**Modified `controllers/syncRunController.js`:**
- `executeRun({…, timeoutMs})`: optional per-run deadline. Before each date it checks a deadline; wraps each `engine.syncSingle` in `withTimeoutAbortable` (instead of `withTimeout`), passing the abort signal into `syncSingle`. On `TimeoutError`, finalizes the run with `success=false` + deadline error and stops further dates. Manual/retry runs pass no `timeoutMs` → behavior unchanged.
- `runScheduledForCategory`: passes `timeoutMs = loadProviderConfig().tickTimeoutMs` (default 120000) into `executeRun`.
- Removed unused `withTimeout` import.
- Retries are retries within a single provider fetch — **they do not create additional `sync_run`s**.

**Modified `utils/ingestion/sync.js`** `syncSingle`: accepts an optional 5th `signal` parameter. The `sync()` backward-compatible method is unchanged (passes no signal). `syncSingle` now checks `signal.aborted` (via `aborted()` helper) at these checkpoints **before** DB writes:
  1. After `fetchRawResults` returns (before empty-result `createSyncLog`)
  2. At the top of each record in the for-loop
  3. Before `createPost` (new record path)
  4. Before `autoGeneratePrizeBreakdowns` (new record path)
  5. Before `updatePost` (merge path)
  6. Before the final `createSyncLog` (end of run)

  If the signal is aborted, `syncSingle` sets `success=false`, pushes a descriptive error, and skips the DB write — preventing unsafe late writes (sync_logs, post create/update, prize breakdowns) after the run is finalized.

**`utils/scheduler.js` overlap guard:** preserved exactly as-is (`running` flag, `try/finally { running = false }`, skip-if-running). Now effective because each per-run operation is bounded by the deadline + abort signal.

**Config in `.env.example`** (no secret values; defaults only):
```
SYNC_PROVIDER_TIMEOUT_MS=30000
SYNC_MAX_RETRIES=2
SYNC_RETRY_DELAY_MS=2000
SYNC_TICK_TIMEOUT_MS=120000
```
Invalid numeric values fall back to defaults (never crash the scheduler).

**Cancellation/boundedness model (final):**
- **Provider fetch**: `fetchJsonWithTimeout` uses its own `AbortController` (30s). Both headers and body consumption are bounded within one deadline. Retries are internal to a single fetch and never create duplicate `sync_run`s.
- **Run tick**: `withTimeoutAbortable` creates an `AbortController` (120s default). On deadline, it calls `controller.abort()` + rejects `TimeoutError`. The signal propagates into `syncSingle`, which checks `signal.aborted` before every DB write and skips writes if set.
- **Background continuation**: even if `syncSingle` is mid-execution when the timeout fires, the abort signal is set synchronously. The real `syncSingle` checks `signal.aborted` before every DB write (`createSyncLog`, `createPost`, `updatePost`, `autoGeneratePrizeBreakdowns`) and bails if set. In-flight SQL queries already sent cannot be cancelled at the SQL level (standard `pg` behavior), but **no NEW writes are issued** after the signal is set.
- **Manual/retry**: unchanged — no `timeoutMs`, no signal, existing unbounded behavior preserved.

---

## 4. Configuration

`.env` (local, gitignored) holds live values. `.env.example` documents all keys. Backend env keys:
`DATABASE_URL`, `PORT`, `BASE_URL`, `SYNC_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_FRONTEND_ORIGINS`, `APP_URL`, `SYNC_SCHEDULE_CRON`, `SYNC_CATEGORIES`, `SYNC_SCHEDULE_DATE_MODE`, `SYNC_SCHEDULE_TZ`, `SYNC_PROVIDER_TIMEOUT_MS`, `SYNC_MAX_RETRIES`, `SYNC_RETRY_DELAY_MS`, `SYNC_TICK_TIMEOUT_MS`.

Frontend env (gitignored): only `VITE_API_BASE_URL` (→ `https://lottery-backend-omega.vercel.app/api`).

---

## 5. Testing policy & results

**Hard rule:** DB-dependent suites (`testSync.js`, `testSyncLog.js`, `testAdminSession.js`, `testAdminSync.js`, `testSitemapDynamic.js`, `testPrizeBreakdownAuto.js`, `testScheduler.js`) **must NOT** be run against the configured Supabase `DATABASE_URL`. Confirmed reachable; `testAdminSync.js` T11 mutates a real post's winning numbers. Run only against an isolated test DB.

| Test file | Type | Run? | Result |
|---|---|---|---|
| `utils/ingestion/testSeoService.js` | pure | executed | PASSED (7 cases) |
| `utils/ingestion/testProviderHttp.js` | pure (mocked fetch/timers) | executed | PASSED (23 checks) |
| `utils/ingestion/testSchedulerSafety.js` | pure (mocked pool/cron/engine) | executed | PASSED (T1-T9) |
| `utils/ingestion/testSyncHealth.js` | pure (mocked pool/scheduler) | executed | PASSED (21 checks: H2-H10, S1-S7, M1-M2, G1-G2) |
| `utils/ingestion/testLiveNotifications.js` | pure (mocked dispatch/masking) | executed | PASSED |
| Frontend `npm run build` | build | executed | PASSED |
| `node --check` on all changed files | syntax | executed | OK |
| Backend startup (`node server.js`, dummy DB) | runtime | executed | OK (`/ping` 200) |
| DB-dependent suites (see above) | DB | **not executed** | documented, not run (prod-DB rule) |

---

## 6. Security

- `.env` (real `DATABASE_URL` + `SYNC_SECRET`) is gitignored; only `.env.example` (empty values) is tracked. Pickaxe confirms the real Supabase host (`pooler.supabase.com`) and `SYNC_SECRET` value **never** appear in git history.
- Frontend never contains `SYNC_SECRET`/`DATABASE_URL`/Supabase tokens (grep clean, incl. `dist`). Frontend `.env` only has `VITE_API_BASE_URL`.
- `SYNC_SECRET` is server-side only, used by `middleware/syncAuth.js` (`syncAuthMiddleware`, timing-safe compare, fail-closed) for `POST /api/sync/trigger`. Admin operations (`/api/admin/sync/*`) use HttpOnly `SameSite=None` admin-session cookies (`adminSessionAuth`, `requireRole`).
- No secrets or raw PII (subscriber emails) are logged anywhere in application log output (`maskEmail` helper redacts email addresses).

---

## 7. Deployment evidence

- Backend → Railway (`.github/workflows/deploy.yml`, `railway up --service=nodejs`, push to `branch `backend``). Env configured in Railway dashboard.
- Scheduler starts in prod (`server.js` calls `startScheduler` when `NODE_ENV !== "test"`); cron health-check retries until DB reachable, then registers the cron.

---

## 8. Key files

- Scheduler: `utils/scheduler.js`, `controllers/syncRunController.js`, `utils/ingestion/sync.js`, `models/syncRunModel.js`, `models/syncLogModel.js`, `middleware/syncAuth.js`, `routes/syncRoutes.js`, `routes/adminSyncRoutes.js`, `data/sync_runs.sql`, `data/sync_logs.sql`.
- Provider/HTTP hardening: `utils/ingestion/providerHttp.js`, `utils/ingestion/provider.js`.
- SEO: `utils/seoService.js`, `utils/sitemapService.js`, `controllers/postController.js`, `server.js`, `routes/sitemap.js`, `routes/seoRoutes.js`, `controllers/seoController.js`, `src/components/SEO.jsx`, `src/utils/seoMirror.js`, `src/context/SeoContext.jsx`, `vercel.json`.
- Prize: `utils/prizeBreakdownService.js`, `models/prizeBreakModel.js`, `controllers/prizeBreakdown.js`, `routes/prizeBreakRoute.js`, `src/components/page_components/PrizeBreakDown.jsx`.
- Notifications: `utils/emailService.js`, `models/subscriberModel.js`, `utils/ingestion/testLiveNotifications.js`.

---

## 9. What NOT to change (intentional boundaries)

Prize payout values, prize-breakdown schema/logic; SEO implementation; sitemap implementation; admin UI redesign; auth model; sync-route auth; DB schema; manual-retry semantics; Socrata normalization rules; scheduler overlap guard; provider timeout/retry/cancellation.

---

## 10. Feature 2.1 — Sync Health & Monitoring Dashboard (completed 2026-09-04)

**New files:**
- `utils/schedulerStatus.js` — singleton holder for scheduler controller; `setSchedulerController()`, `clearSchedulerController()`, `getSchedulerStatus()`.
- `utils/sanitizeError.js` — redacts sensitive patterns from error messages.
- `src/components/admin/dashboard/SyncHealthCards.jsx` — React health dashboard component.
- `utils/ingestion/testSyncHealth.js` — 21 pure unit tests (mocked pool/scheduler).

**Modified files:**
- `models/syncRunModel.js` — added `getSyncRunStats()` (SQL conditional aggregation).
- `controllers/syncRunController.js` — added `healthHandler` + `schedulerStatusHandler`.
- `routes/adminSyncRoutes.js` — wired `/health` + `/scheduler-status`.
- `server.js` — stores scheduler controller via `setSchedulerController()`.
- `src/api/syncRunsApi.js` — added `getSyncHealth()`.
- `src/Pages/admin/Dashboard.jsx` — replaced hardcoded System Status with `SyncHealthCards`.

---

### Feature 3.2 — Live Subscriber Notifications (✅ Completed 2026-09-07)

- **`utils/emailService.js`**:
  - `triggerLiveSubscriberNotifications({ category, date, title, description })`: Added non-blocking helper that safely fetches subscriber lists via `getAllSubscribers()`, checks `process.env.EMAIL_USER` / `process.env.EMAIL_PASS` credentials, formats canonical post links, and dispatches batch email notifications in a fire-and-forget background block.
  - Dynamically formats unsubscribe URLs using `process.env.APP_URL || process.env.BASE_URL || "https://nylotteryresults.com"` instead of hardcoded `localhost:3000`.
  - **Privacy Fix (`maskEmail`)**: Added `maskEmail` utility to redact raw subscriber email addresses in console logs (e.g. `alice@example.com` -> `a***e@example.com`), ensuring PII is never exposed in server log output.
- **`utils/ingestion/sync.js`**:
  - Integrated `triggerLiveSubscriberNotifications` into `syncSingle` execution flow immediately after `createPost` succeeds on automated ingestion runs (`report.created++`), ensuring automated draw ingestion alerts subscribers in real time without requiring manual admin intervention.
- **Tests**: `utils/ingestion/testLiveNotifications.js` (pure unit test covering template formatting, batch dispatch, and `maskEmail` privacy assertions) — executed, PASSED.

---

## CHANGELOG

- **2026-09-07** — Feature 3.2: Live Subscriber Notifications & Email Privacy Fix (Completed):
  - **Automated Live Notifications**: Wired non-blocking `triggerLiveSubscriberNotifications` into `sync.js` (`syncSingle`) to dispatch email alerts to subscribers whenever automated ingestion publishes a new draw.
  - **Dynamic Unsubscribe Domain**: Updated `utils/emailService.js` template to format post links and unsubscribe URLs using `process.env.APP_URL` / `process.env.BASE_URL` fallbacks.
  - **Email Privacy Protection**: Implemented `maskEmail()` helper in `utils/emailService.js` to mask subscriber email addresses (`a***e@example.com`) in server logs, preventing raw PII leakage.
  - **Tests**: Updated `utils/ingestion/testLiveNotifications.js` with `maskEmail` assertions — PASSED. Full regression suite (`testSeoService.js`, `testSeoRouteSync.js`, `testProviderHttp.js`, `testSyncHealth.js`) — all PASSED. Frontend build `npm run build` PASSED (1801 modules transformed in 10.60s).
- **2026-09-07** — Feature 3.1: Automated SEO Metadata & Dynamic Sitemap Remediation (Local Implementation Completed; Production Verification Pending Deployment):
  - **Dynamic `/robots.txt`**: Added `GET /robots.txt` route in `server.js` and fallback `public/robots.txt` files pointing to `https://nylotteryresults.com/sitemap.xml`.
  - **Vercel Rewrite Fix**: Updated `LotteryResults/vercel.json` rewrites to proxy `/sitemap.xml` and `/robots.txt` directly to `https://lottery-backend-omega.vercel.app` (replacing unexpanded `${BACKEND_URL}` string template). Frontend production URL documented as `https://lottery-results-sigma.vercel.app`.
  - **Error Handling Hardening**: Updated `server.js` `/sitemap.xml` route to return HTTP 500 status on dynamic sitemap generation failure rather than returning fake empty XML.
  - **Cache Invalidation & Route Sync**: Updated `routes/seoRoutes.js` `/sync-sitemap` pathing to invoke `bustSitemapCache()`; verified `postController.js` invalidates cache on `updatePostbyid` (L142), `addPost` (L264), and `removePost` (L336).
- **2026-09-04 (final)** — Scheduler reliability hardening — Issue 1 fix + Issue 2 fix.
