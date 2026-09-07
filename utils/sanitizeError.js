// utils/sanitizeError.js
//
// Redacts sensitive information from error messages before returning them
// in API responses. Even though the health endpoint is admin-authenticated,
// we never want to leak connection strings, secrets, tokens, or credentials
// that might appear in a provider error message.

const SENSITIVE_PATTERNS = [
  // Connection strings with credentials: postgres://user:pass@host
  { regex: /(postgres|postgresql|mysql|mssql):\/\/[^:]+:[^@]+@/gi, replacement: "$1://***:***@" },
  // URLs with query strings that may contain API keys/tokens (any scheme, not just http)
  { regex: /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^?\s'"]*\?)[^?\s'"]+/gi, replacement: "$1[REDACTED]" },
  // Bearer tokens
  { regex: /[Bb]earer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: "Bearer [REDACTED]" },
  // Authorization: Basic ...
  { regex: /[Aa]uthorization:\s*[Bb]asic\s+[A-Za-z0-9+/=]+/g, replacement: "Authorization: [REDACTED]" },
  // SYNC_SECRET=value
  { regex: /[Ss][Yy][Nn][Cc][_]?[Ss][Ee][Cc][Rr][Ee][Tt][=:]?\s*\S+/g, replacement: "SYNC_SECRET=[REDACTED]" },
  // DATABASE_URL=value (may contain credentials in the URL)
  { regex: /DATABASE_URL[=:]?\s*\S+/gi, replacement: "DATABASE_URL=[REDACTED]" }
];

export function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== "string") return msg;
  let sanitized = msg;
  for (const { regex, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

export function sanitizeErrorsArray(errors) {
  if (!Array.isArray(errors)) return [];
  return errors.map(sanitizeErrorMessage);
}
