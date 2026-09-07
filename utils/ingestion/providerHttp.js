// utils/ingestion/providerHttp.js
//
// Reusable, dependency-free HTTP hardening helpers for scheduled ingestion.
//
// Covers the scheduler reliability hardening pass:
//   * hard deadline on every provider HTTP request (AbortController timeout)
//   * bounded automatic retry with exponential backoff for transient failures
//   * per-run tick deadline to keep a single scheduled operation bounded
//
// Design notes:
//   - Retries/aborts only ever originate from this module. They do NOT create
//     new sync_runs (those are still created once per scheduled run by the
//     controller layer). Retries are internal attempts within a single fetch.
//   - No secrets, DATABASE_URL, SYNC_SECRET, cookies, or auth headers are
//     ever logged by anything in this file.
//   - Node.js built-ins only (AbortController, setTimeout). No new deps.

export class TimeoutError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "TimeoutError";
    this.timeoutMs = meta.timeoutMs;
  }
}

// HTTP status codes considered transient and therefore eligible for retry.
export function isRetryableHttpStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

// Decide whether a thrown error is one we should retry.
//   - TimeoutError (our own deadline) -> retryable
//   - TypeError thrown by fetch (network failure / DNS / connection reset) -> retryable
//   - An error carrying an HTTP status that is transient -> retryable
//   - Everything else (4xx, validation, malformed payload, config/auth) -> NOT retryable
export function isRetryableProviderError(err) {
  if (!err) return false;
  if (err.name === "TimeoutError") return true;
  if (err instanceof TypeError) return true;
  const status = err.status || err.statusCode || err.responseStatus;
  if (typeof status === "number" && isRetryableHttpStatus(status)) return true;
  return false;
}

const DEFAULT_PROVIDER_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 2000;
const DEFAULT_TICK_TIMEOUT_MS = 120000;

function coercePositiveNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

// Resolve + validate scheduler HTTP/deadline config from an env object.
// Invalid values fall back to safe defaults (never throw).
export function loadProviderConfig(env = process.env) {
  return {
    providerTimeoutMs: coercePositiveNumber(
      env.SYNC_PROVIDER_TIMEOUT_MS,
      DEFAULT_PROVIDER_TIMEOUT_MS
    ),
    maxRetries: (() => {
      if (env.SYNC_MAX_RETRIES === undefined || env.SYNC_MAX_RETRIES === null || env.SYNC_MAX_RETRIES === "") {
        return DEFAULT_MAX_RETRIES;
      }
      const n = Number(env.SYNC_MAX_RETRIES);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return DEFAULT_MAX_RETRIES;
      return n;
    })(),
    retryDelayMs: coercePositiveNumber(
      env.SYNC_RETRY_DELAY_MS,
      DEFAULT_RETRY_DELAY_MS
    ),
    tickTimeoutMs: coercePositiveNumber(
      env.SYNC_TICK_TIMEOUT_MS,
      DEFAULT_TICK_TIMEOUT_MS
    )
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fetch() with a hard deadline. Aborts the request when the deadline is
// exceeded and rejects with a TimeoutError. Always clears the timer on
// completion (success, failure, or timeout) so no timers leak.
export async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_PROVIDER_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const signal = controller.signal;
  try {
    return await fetch(url, { ...options, signal });
  } catch (err) {
    if (signal.aborted) {
      throw new TimeoutError(`Provider request timed out after ${ms}ms`, { timeoutMs: ms });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// fetch() + response.json() within a single hard deadline. The entire
// provider response — headers AND body consumption — is bounded by the
// timeout. Aborts via the same AbortController on expiration and rejects
// with a TimeoutError. Always clears the timer (no leaks).
//
// Malformed JSON throws a SyntaxError (NOT a TimeoutError) which propagates
// as a permanent/non-retryable failure.
export async function fetchJsonWithTimeout(url, options = {}, timeoutMs) {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_PROVIDER_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const signal = controller.signal;
  try {
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) {
      const err = new Error(`HTTP error fetching results: ${response.status} ${response.statusText}`);
      err.status = response.status;
      throw err;
    }
    return await response.json();
  } catch (err) {
    if (signal.aborted) {
      throw new TimeoutError(`Provider request timed out after ${ms}ms`, { timeoutMs: ms });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Bounded retry with exponential backoff. `fn` is the operation; `isRetryable`
// decides whether to retry; `onRetry` is an optional diagnostics hook.
//
// attempt sequence with maxRetries=2: initial -> retry-1 -> retry-2
// delay before attempt n (1-indexed retry) = baseDelayMs * 2^(n-1)
//   retry-1 -> baseDelayMs * 2^0 (=2000ms)
//   retry-2 -> baseDelayMs * 2^1 (=4000ms)
export async function withRetry(fn, {
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelayMs = DEFAULT_RETRY_DELAY_MS,
  isRetryable = isRetryableProviderError,
  onRetry,
  sleepFn = sleep
} = {}) {
  let attempt = 0; // 0 = initial attempt
  const totalAttempts = 1 + maxRetries;
  let lastError;

  while (attempt < totalAttempts) {
    try {
      const isInitial = attempt === 0;
      return await fn(attempt, isInitial ? "initial" : `retry-${attempt}`);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt >= maxRetries) {
        throw err;
      }
      const retryNumber = attempt + 1;
      const delay = baseDelayMs * Math.pow(2, attempt); // 2000, 4000, ...
      if (typeof onRetry === "function") {
        onRetry(err, retryNumber, delay);
      }
      await sleepFn(delay);
      attempt = retryNumber;
    }
  }
  throw lastError;
}

// Bound a single Promise with a deadline. Rejects with TimeoutError on
// expiration. Always clears its timer (no lingering timers). The underlying
// promise may continue in the background (e.g. an in-flight fetch that has its
// own AbortController), but this helper never leaves a dangling timer.
export function withTimeout(promise, timeoutMs, label) {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TICK_TIMEOUT_MS;
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label || `Operation timed out after ${ms}ms`, { timeoutMs: ms })), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Like withTimeout, but creates an AbortController and passes its signal to a
// factory function. When the deadline fires the controller is aborted, giving
// the inner work an opportunity to stop early (cooperative cancellation)
// instead of running to completion in the background.
//
// The race still rejects with a TimeoutError on expiration. The timer is
// always cleared (no leaks). The underlying promise is NOT awaited after a
// timeout, but its abort signal is set so well-behaved callers can bail
// before performing unsafe late writes (DB inserts/updates).
export function withTimeoutAbortable(promiseFactory, timeoutMs, label) {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TICK_TIMEOUT_MS;
  const controller = new AbortController();
  const signal = controller.signal;
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(label || `Operation timed out after ${ms}ms`, { timeoutMs: ms }));
    }, ms);
  });
  return Promise.race([promiseFactory(signal), timeoutPromise]).finally(() => clearTimeout(timer));
}
