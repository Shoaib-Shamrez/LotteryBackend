import crypto from "crypto";

export const syncAuthMiddleware = (req, res, next) => {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    console.error("SYNC_SECRET environment variable is not configured.");
    return res.status(500).json({
      success: false,
      error: "Internal Server Error"
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  const token = authHeader.substring(7);

  // Use timing-safe constant-time comparison via SHA-256 hashing to protect against timing attacks
  const secretHash = crypto.createHash("sha256").update(secret).digest();
  const tokenHash = crypto.createHash("sha256").update(token).digest();
  // Guard against length mismatch to avoid timingSafeEqual throwing
  if (secretHash.length !== tokenHash.length) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }
  try {
    if (crypto.timingSafeEqual(secretHash, tokenHash)) {
      return next();
    }
  } catch (err) {
    // Fail closed
  }

  return res.status(401).json({
    success: false,
    error: "Unauthorized"
  });
};
