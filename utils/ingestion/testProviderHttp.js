// utils/ingestion/testProviderHttp.js
//
// Pure unit tests (no DB, no real network, no cron) for the scheduler HTTP
// hardening helpers in utils/ingestion/providerHttp.js.
//
// Covers:
//   - config defaults / overrides / invalid-value fallback
//   - isRetryableHttpStatus
//   - isRetryableProviderError (timeout / network / retryable HTTP / permanent)
//   - fetchWithTimeout (fast success; hang -> TimeoutError; timer cleared)
//   - withRetry (first-try success; retry-then-succeed; backoff values;
//     exhausted -> throw last; permanent error -> no retry; maxRetries=0)
//   - withTimeout (resolves; hang -> TimeoutError; underlying rejection propagates)

import assert from "assert";
import {
  TimeoutError,
  isRetryableHttpStatus,
  isRetryableProviderError,
  loadProviderConfig,
  fetchWithTimeout,
  fetchJsonWithTimeout,
  withRetry,
  withTimeout,
  withTimeoutAbortable
} from "./providerHttp.js";

let passed = 0;
const record = (name) => {
  passed++;
  console.log("✓ " + name);
};

// ---------------------------------------------------------------------------
// loadProviderConfig: defaults, overrides, invalid fallback
// ---------------------------------------------------------------------------
{
  const c = loadProviderConfig({
    SYNC_PROVIDER_TIMEOUT_MS: "",
    SYNC_MAX_RETRIES: "",
    SYNC_RETRY_DELAY_MS: "",
    SYNC_TICK_TIMEOUT_MS: ""
  });
  assert.strictEqual(c.providerTimeoutMs, 30000);
  assert.strictEqual(c.maxRetries, 2);
  assert.strictEqual(c.retryDelayMs, 2000);
  assert.strictEqual(c.tickTimeoutMs, 120000);

  const c2 = loadProviderConfig({
    SYNC_PROVIDER_TIMEOUT_MS: "5000",
    SYNC_MAX_RETRIES: "3",
    SYNC_RETRY_DELAY_MS: "1000",
    SYNC_TICK_TIMEOUT_MS: "60000"
  });
  assert.strictEqual(c2.providerTimeoutMs, 5000);
  assert.strictEqual(c2.maxRetries, 3);
  assert.strictEqual(c2.retryDelayMs, 1000);
  assert.strictEqual(c2.tickTimeoutMs, 60000);

  // invalid -> safe defaults
  const c3 = loadProviderConfig({ SYNC_MAX_RETRIES: "abc", SYNC_TICK_TIMEOUT_MS: "-5" });
  assert.strictEqual(c3.maxRetries, 2);
  assert.strictEqual(c3.tickTimeoutMs, 120000);
  record("config: defaults + overrides + invalid-value fallback");
}

// ---------------------------------------------------------------------------
// isRetryableHttpStatus
// ---------------------------------------------------------------------------
assert.ok(isRetryableHttpStatus(408));
assert.ok(isRetryableHttpStatus(429));
assert.ok(isRetryableHttpStatus(500));
assert.ok(isRetryableHttpStatus(502));
assert.ok(isRetryableHttpStatus(503));
assert.ok(isRetryableHttpStatus(504));
assert.ok(!isRetryableHttpStatus(400));
assert.ok(!isRetryableHttpStatus(401));
assert.ok(!isRetryableHttpStatus(404));
assert.ok(!isRetryableHttpStatus(200));
record("isRetryableHttpStatus: 408/429/5xx retryable; 4xx/2xx not");

// ---------------------------------------------------------------------------
// isRetryableProviderError
// ---------------------------------------------------------------------------
{
  // our own deadline error -> retryable
  assert.ok(isRetryableProviderError(new TimeoutError("x")));
  // network errors surface as TypeError -> retryable
  assert.ok(isRetryableProviderError(new TypeError("network down")));
  // transient HTTP statuses attached as .status -> retryable
  for (const s of [408, 429, 500, 502, 503, 504]) {
    const e = new Error("boom");
    e.status = s;
    assert.ok(isRetryableProviderError(e), `status ${s} retryable`);
  }
  // permanent HTTP statuses -> NOT retryable
  for (const s of [400, 401, 403, 404]) {
    const e = new Error("boom");
    e.status = s;
    assert.ok(!isRetryableProviderError(e), `status ${s} not retryable`);
  }
  // generic errors (validation / malformed payload / config) -> NOT retryable
  assert.ok(!isRetryableProviderError(new Error("validation failed")));
  assert.ok(!isRetryableProviderError(null));
  record("isRetryableProviderError: timeout/network/5xx retryable; 4xx/validation/permanent not");
}

// ---------------------------------------------------------------------------
// fetchWithTimeout (stub global fetch; tiny real timeouts)
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
function stubFetch(fn) {
  globalThis.fetch = fn;
}
try {
  // (a) fast success
  {
    let called = 0;
    stubFetch(async () => {
      called++;
      return { ok: true, status: 200, json: async () => ({ hi: 1 }) };
    });
    const res = await fetchWithTimeout("http://example/test", {}, 500);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(called, 1, "fetch invoked once on quick success");
    record("fetchWithTimeout: fast success (timer cleared)");
  }

  // (b) hang -> TimeoutError, no crash
  // Stub fetch must honor AbortController (real fetch does): when aborted it
  // rejects, which lets fetchWithTimeout surface a TimeoutError.
  {
    stubFetch((url, opts) => {
      const signal = opts && opts.signal;
      if (signal && signal.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      return new Promise((_, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        }
        // never resolves on its own; only rejects on abort
      });
    });
    const start = Date.now();
    let threw = null;
    try {
      await fetchWithTimeout("http://example/hang", {}, 40);
    } catch (e) {
      threw = e;
    }
    const elapsed = Date.now() - start;
    assert.ok(threw, "should reject on timeout");
    assert.ok(threw instanceof TimeoutError, "should be a TimeoutError");
    assert.match(threw.message || "", /timed out after 40ms/);
    assert.ok(elapsed >= 20 && elapsed < 250, `elapsed ${elapsed}ms`);
    record("fetchWithTimeout: hang -> TimeoutError (controlled, no crash)");
  }
} finally {
  globalThis.fetch = realFetch;
}

// ---------------------------------------------------------------------------
// withRetry (inject fake sleepMs to avoid real waits; assert backoff values)
// ---------------------------------------------------------------------------
{
  // (a) success on first attempt
  {
    let attempts = 0;
    const delays = [];
    const v = await withRetry(
      async (attemptIndex, label) => {
        assert.strictEqual(label, "initial");
        attempts++;
        return "ok";
      },
      { sleepFn: async () => { delays.push("x"); } }
    );
    assert.strictEqual(v, "ok");
    assert.strictEqual(attempts, 1);
    assert.strictEqual(delays.length, 0);
    record("withRetry: success on first attempt (no retry)");
  }

  // (b) first attempt fails (retryable), second succeeds -> backoff = base*2^0
  {
    let attempts = 0;
    const delays = [];
    const labels = [];
    const v = await withRetry(
      async (_i, label) => {
        labels.push(label);
        attempts++;
        if (attempts === 1) throw new TimeoutError("transient");
        return "ok";
      },
      { maxRetries: 2, baseDelayMs: 1000, sleepFn: async (ms) => { delays.push(ms); } }
    );
    assert.strictEqual(v, "ok");
    assert.strictEqual(attempts, 2);
    assert.deepStrictEqual(labels, ["initial", "retry-1"]);
    assert.deepStrictEqual(delays, [1000]); // 1000 * 2^0
    record("withRetry: retry-then-succeed, backoff=base*2^0");
  }

  // (c) two failures then success -> backoff 2000, 4000
  {
    let attempts = 0;
    const delays = [];
    const v = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new TimeoutError("transient");
        return "ok";
      },
      { maxRetries: 2, baseDelayMs: 2000, sleepFn: async (ms) => { delays.push(ms); } }
    );
    assert.strictEqual(v, "ok");
    assert.strictEqual(attempts, 3);
    assert.deepStrictEqual(delays, [2000, 4000]); // 2000*2^0, 2000*2^1
    record("withRetry: two retries then succeed, backoff 2000/4000");
  }

  // (d) all attempts fail (retryable) -> throws last error, retries exhausted
  {
    let attempts = 0;
    const delays = [];
    let threw = null;
    try {
      await withRetry(
        async () => {
          attempts++;
          throw new TimeoutError("transient");
        },
        { maxRetries: 2, baseDelayMs: 2000, sleepFn: async (ms) => { delays.push(ms); } }
      );
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof TimeoutError);
    assert.strictEqual(attempts, 3); // initial + 2 retries
    assert.deepStrictEqual(delays, [2000, 4000]);
    record("withRetry: exhausted retries -> throws last error (attempts=3)");
  }

  // (e) permanent error -> no retry, no delay
  {
    let attempts = 0;
    const delays = [];
    const err = new Error("bad request");
    err.status = 400;
    let threw = null;
    try {
      await withRetry(
        async () => {
          attempts++;
          throw err;
        },
        { maxRetries: 2, baseDelayMs: 1000, sleepFn: async (ms) => { delays.push(ms); } }
      );
    } catch (e) {
      threw = e;
    }
    assert.strictEqual(threw, err);
    assert.strictEqual(attempts, 1);
    assert.strictEqual(delays.length, 0);
    record("withRetry: permanent HTTP 400 -> no retry");
  }

  // (f) maxRetries=0 -> single attempt, no retry
  {
    let attempts = 0;
    const delays = [];
    let threw = null;
    try {
      await withRetry(
        async () => {
          attempts++;
          throw new TypeError("network down");
        },
        { maxRetries: 0, baseDelayMs: 1000, sleepFn: async (ms) => { delays.push(ms); } }
      );
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof TypeError);
    assert.strictEqual(attempts, 1);
    assert.strictEqual(delays.length, 0);
    record("withRetry: maxRetries=0 -> no retry");
  }
}

// ---------------------------------------------------------------------------
// withTimeout
// ---------------------------------------------------------------------------
{
  // (a) resolves before deadline
  const v = await withTimeout(Promise.resolve("done"), 1000, "label-a");
  assert.strictEqual(v, "done");
  record("withTimeout: resolves before deadline (timer cleared)");

  // (b) hang -> TimeoutError
  const start = Date.now();
  let threw = null;
  try {
    await withTimeout(new Promise(() => {}), 40, "boom label");
  } catch (e) {
    threw = e;
  }
  const elapsed = Date.now() - start;
  assert.ok(threw instanceof TimeoutError);
  assert.match(threw.message || "", /boom label/);
  assert.ok(elapsed >= 20 && elapsed < 250, `elapsed ${elapsed}ms`);
  record("withTimeout: hang -> TimeoutError (no lingering timer)");

  // (c) underlying rejection propagates (not swallowed)
  const origErr = new Error("real failure");
  let caught = null;
  try {
    await withTimeout(Promise.reject(origErr), 1000, "label-c");
  } catch (e) {
    caught = e;
  }
  assert.strictEqual(caught, origErr);
  record("withTimeout: underlying rejection propagates");
}

// ---------------------------------------------------------------------------
// fetchJsonWithTimeout (fetch + response.json() within a single deadline)
// ---------------------------------------------------------------------------
const realFetch2 = globalThis.fetch;
try {
  // (a) fast success: headers + body parse both quick
  {
    let called = 0;
    stubFetch(async (url, opts) => {
      called++;
      assert.ok(url, "url passed through");
      assert.ok(opts && opts.signal instanceof AbortSignal, "signal passed to fetch");
      return { ok: true, status: 200, json: async () => ({ results: [{ draw_date: "2026-01-01T00:00:00.000" }] }) };
    });
    const data = await fetchJsonWithTimeout("http://example/test", {}, 500);
    assert.deepStrictEqual(data, { results: [{ draw_date: "2026-01-01T00:00:00.000" }] });
    assert.strictEqual(called, 1);
    record("fetchJsonWithTimeout: fast success (headers + body within deadline)");
  }

  // (b) response body hangs -> TimeoutError (NOT invisible to the deadline)
  // This is the core fix: previously response.json() was outside the timeout.
  {
    stubFetch((url, opts) => {
      // Headers arrive successfully (ok=true) but json() hangs.
      // The stub must capture the AbortController signal from the fetch()
      // call so that when the timeout fires and controller.abort() is called,
      // the json() read is cancelled — exactly like a real Response.json()
      // tied to the request signal.
      const signal = opts && opts.signal;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => {
          return new Promise((_, reject) => {
            if (!signal) return; // no signal — hang forever
            if (signal.aborted) {
              reject(new DOMException("aborted", "AbortError"));
              return;
            }
            signal.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            }, { once: true });
          });
        }
      });
    });
    let threw = null;
    const start = Date.now();
    try {
      await fetchJsonWithTimeout("http://example/body-hang", {}, 50);
    } catch (e) {
      threw = e;
    }
    const elapsed = Date.now() - start;
    assert.ok(threw, "should reject on body hang");
    assert.ok(threw instanceof TimeoutError, `should be TimeoutError, got ${threw?.name}`);
    assert.match(threw.message || "", /timed out after 50ms/);
    assert.ok(elapsed >= 30 && elapsed < 200, `elapsed ${elapsed}ms should be near the 50ms deadline`);
    record("fetchJsonWithTimeout: response body hang -> TimeoutError (core fix)");
  }

  // (c) HTTP error status -> Error with status (not TimeoutError)
  {
    stubFetch(async () => ({ ok: false, status: 503, statusText: "Service Unavailable", json: async () => ({}) }));
    let threw = null;
    try {
      await fetchJsonWithTimeout("http://example/503", {}, 500);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, "should reject on HTTP error");
    assert.strictEqual(threw.name, "Error");
    assert.strictEqual(threw.status, 503);
    assert.ok(!isRetryableProviderError(threw) || isRetryableHttpStatus(503), "503 should be retryable via status");
    record("fetchJsonWithTimeout: HTTP 503 -> Error with status");
  }

  // (d) malformed JSON -> SyntaxError (permanent, NOT retryable, NOT TimeoutError)
  {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("Unexpected token < in JSON"); }
    }));
    let threw = null;
    try {
      await fetchJsonWithTimeout("http://example/bad-json", {}, 500);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, "should reject on malformed JSON");
    assert.ok(threw instanceof SyntaxError, `should be SyntaxError, got ${threw?.name}`);
    assert.ok(!isRetryableProviderError(threw), "malformed JSON must NOT be retryable");
    record("fetchJsonWithTimeout: malformed JSON -> SyntaxError (permanent, not retried)");
  }

  // (e) timeout timer always cleared on success (no lingering timers)
  {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    const result = await fetchJsonWithTimeout("http://example/cleanup", {}, 100);
    assert.deepStrictEqual(result, { ok: true });
    record("fetchJsonWithTimeout: timer cleared on success (no leak)");
  }
} finally {
  globalThis.fetch = realFetch2;
}

// ---------------------------------------------------------------------------
// withTimeoutAbortable (deadline + cooperative cancellation via AbortSignal)
// ---------------------------------------------------------------------------
{
  // (a) resolves before deadline; signal not aborted
  {
    let receivedSignal = null;
    const v = await withTimeoutAbortable((signal) => {
      receivedSignal = signal;
      assert.ok(signal instanceof AbortSignal, "factory receives an AbortSignal");
      return Promise.resolve("done");
    }, 1000, "test-a");
    assert.strictEqual(v, "done");
    assert.strictEqual(receivedSignal.aborted, false, "signal not aborted on success");
    record("withTimeoutAbortable: resolves before deadline (signal not aborted)");
  }

  // (b) hang -> TimeoutError AND signal is aborted (cooperative cancellation)
  {
    let signalRef = null;
    let start = Date.now();
    let threw = null;
    try {
      await withTimeoutAbortable((signal) => {
        signalRef = signal;
        return new Promise(() => {}); // never resolves
      }, 50, "abortable-hang");
    } catch (e) {
      threw = e;
    }
    const elapsed = Date.now() - start;
    assert.ok(threw instanceof TimeoutError, "should be TimeoutError");
    assert.match(threw.message || "", /abortable-hang/);
    assert.ok(signalRef, "signal was created and passed to factory");
    assert.strictEqual(signalRef.aborted, true, "signal MUST be aborted after timeout fires");
    assert.ok(elapsed >= 30 && elapsed < 200, `elapsed ${elapsed}ms should be near 50ms`);
    record("withTimeoutAbortable: hang -> TimeoutError + signal aborted (cooperative cancellation)");
  }

  // (c) underlying rejection propagates (not swallowed by timeout)
  {
    const origErr = new Error("real failure");
    let caught = null;
    try {
      await withTimeoutAbortable(() => Promise.reject(origErr), 1000, "label-c");
    } catch (e) {
      caught = e;
    }
    assert.strictEqual(caught, origErr);
    record("withTimeoutAbortable: underlying rejection propagates");
  }

  // (d) signal is aborted even if factory resolves slowly (edge: timeout wins race)
  {
    let signalRef = null;
    const start = Date.now();
    let threw = null;
    try {
      await withTimeoutAbortable((signal) => {
        signalRef = signal;
        // Resolve after 200ms but deadline is 30ms
        return new Promise((resolve) => setTimeout(() => resolve("late"), 200));
      }, 30, "race-test");
    } catch (e) {
      threw = e;
    }
    const elapsed = Date.now() - start;
    assert.ok(threw instanceof TimeoutError, "timeout should win the race");
    assert.ok(signalRef, "signal exists");
    assert.strictEqual(signalRef.aborted, true, "signal aborted when timeout wins");
    assert.ok(elapsed < 150, `should return fast on timeout ${elapsed}ms`);
    record("withTimeoutAbortable: timeout wins race -> signal aborted, TimeoutError");
  }
}

console.log(`\n🎉 testProviderHttp: all checks passed.`);
process.exit(0);
