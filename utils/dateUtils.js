// utils/dateUtils.js
// Normalizes a date input (Date object or ISO/SQL string) to YYYY-MM-DD format.
export const normalizeDate = (dateInput) => {
  if (!dateInput) return null;
  // Date instance
  if (dateInput instanceof Date) {
    return dateInput.toISOString().slice(0, 10);
  }
  // Parse string (could be Date string from DB or ISO)
  const d = new Date(dateInput);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
};
