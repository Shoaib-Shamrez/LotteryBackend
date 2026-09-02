// middleware/adminSessionAuth.js
//
// Verifies the HMAC-signed `admin_session` cookie set by /api/user/login.
// Cookie format: base64url(JSON{uid,role,exp}).base64url(HMAC-SHA256(payload, ADMIN_SESSION_SECRET))
//
// Sets req.user = { id, role } on success. Returns 401 otherwise.
// Uses timing-safe comparison to prevent timing attacks.

import crypto from "crypto";

const COOKIE_NAME = "admin_session";

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET;
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function b64urlEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export const adminSessionAuth = (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const secret = getSecret();
  if (!secret) {
    console.error("ADMIN_SESSION_SECRET environment variable is not configured.");
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }

  const dot = raw.lastIndexOf(".");
  if (dot === -1) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  // Verify signature (timing-safe)
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  let sigBuf;
  try {
    sigBuf = b64urlDecode(sigB64);
  } catch {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (sigBuf.length !== expected.length || !crypto.timingSafeEqual(sigBuf, expected)) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  // Decode payload
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!payload || typeof payload !== "object") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  // Expiry
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSec) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!Number.isFinite(payload.uid) || typeof payload.role !== "string") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  req.user = { id: payload.uid, role: payload.role };
  return next();
};

// Helpers exported for the login controller.
export function signAdminSession({ uid, role, ttlSeconds = 86400 }) {
  const secret = getSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = JSON.stringify({ uid, role, exp });
  const payloadB64 = b64urlEncode(Buffer.from(payload, "utf8"));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  return `${payloadB64}.${b64urlEncode(sig)}`;
}