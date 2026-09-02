// middleware/requireRole.js
//
// Returns Express middleware that 403s if req.user.role is not in allowedRoles.
// Requires adminSessionAuth to have run first to populate req.user.

export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  return next();
};