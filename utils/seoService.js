// utils/seoService.js
//
// Pure SEO metadata generators for post records.
// No DB access. No side effects. Easy to unit test.
//
// Source of truth for the display names of every supported lottery category.

export const GAME_NAMES = Object.freeze({
  numbers: "New York Daily Numbers",
  win4: "New York Win 4",
  take5: "New York Take 5",
  lotto: "New York Lotto",
  powerball: "Powerball",
  megamillions: "Mega Millions"
});

const DESCRIPTION_MAX_LEN = 160;

function safe(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function trimAndStrip(value) {
  return safe(value).replace(/[\u0000-\u001f\u007f]+/g, "").trim();
}

function titleCaseSlug(slug) {
  return String(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateOnly(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const s = value.length >= 10 ? value.slice(0, 10) : value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return safe(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function joinNumbers(nums) {
  if (!Array.isArray(nums) || nums.length === 0) return null;
  return nums.map((n) => safe(n).trim()).filter(Boolean).join(", ");
}

/**
 * Generate SEO meta fields for a post.
 *
 * Rules:
 *   metaTitle  -> "<GAME_NAMES[category]> Winning Numbers - <YYYY-MM-DD>"
 *                 or, if a `title` is provided, "<title> | <GAME_NAMES[category]>"
 *   metaDescription -> "<GAME_NAMES[category]> winning numbers for <date>.
 *                       Midday: <nums> | Evening: <nums>."  (N/A when a session is missing)
 *                 Capped at DESCRIPTION_MAX_LEN.
 *
 * Never returns null. Never returns an empty string.
 */
export function generateSeoFields({
  category,
  date,
  middayWinningNumbers,
  eveningWinningNumbers,
  title
} = {}) {
  const cat = safe(category).toLowerCase();
  const dateStr = formatDateOnly(date);
  const gameName = GAME_NAMES[cat] || titleCaseSlug(cat);

  let metaTitle;
  const cleanedTitle = trimAndStrip(title);
  if (cleanedTitle) {
    metaTitle = `${cleanedTitle} | ${gameName}`;
  } else {
    metaTitle = `${gameName} Winning Numbers - ${dateStr}`;
  }
  metaTitle = trimAndStrip(metaTitle);
  if (!metaTitle) metaTitle = `${gameName} Results`;

  const midday = joinNumbers(middayWinningNumbers) ?? "N/A";
  const evening = joinNumbers(eveningWinningNumbers) ?? "N/A";
  let metaDescription = trimAndStrip(
    `${gameName} winning numbers for ${dateStr}. Midday: ${midday} | Evening: ${evening}.`
  );
  if (metaDescription.length > DESCRIPTION_MAX_LEN) {
    metaDescription = metaDescription.slice(0, DESCRIPTION_MAX_LEN - 1).trimEnd() + "…";
  }
  if (!metaDescription) {
    metaDescription = `${gameName} results.`;
  }

  return { metaTitle, metaDescription };
}
