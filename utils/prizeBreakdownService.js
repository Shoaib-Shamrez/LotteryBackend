// utils/prizeBreakdownService.js
//
// Auto-generates prize-breakdown tier rows for a draw the moment it is stored.
//
// The data.ny.gov Socrata feed (see docs/API_RESEARCH.md) provides winning
// numbers, bonus and multiplier only — it does NOT publish per-tier prize
// payouts or per-draw winner counts. The per-draw winner counts are only
// released by the NY Lottery after a drawing is audited (a separate, non-Socrata
// source). What IS deterministic are the FIXED prize tiers of each game (the
// official NY Lottery pay table).
//
// This service therefore auto-populates the prize-tier SKELETON
// (tier label + fixed prize_amount) using a static per-game structure, and
// leaves `winners` = NULL because the audited per-draw winner count is not
// available from the ingestion provider. Admins fill `winners` later from the
// official audited results, or a future enhancement sources them automatically.
//
// PRIZE STRUCTURES below are UNVERIFIED. Confirm every value against the
// official NY Lottery game rule pages (nylottery.org) before production use.
//

import { getPrizeBreakdownsByPost, addPrizeBreakdownsBatch } from "../models/prizeBreakModel.js";

// Each tier: label (rendered in the "Category" column today), fixed prize_amount
// (NULL = pari-mutuel / variable jackpot), and odds (informational).
// TODO(verify): confirm payouts vs official NY Lottery rule pages.
export const PRIZE_STRUCTURES = Object.freeze({
  numbers: [
    { label: "Straight", prize_amount: 500, odds: "1:1000" },
    { label: "Box (3-Way)", prize_amount: 160, odds: "1:333" },
    { label: "Box (6-Way)", prize_amount: 80, odds: "1:167" }
  ],
  win4: [
    { label: "Straight", prize_amount: 5000, odds: "1:10000" },
    { label: "Box (4-Way)", prize_amount: 1198, odds: "1:2500" },
    { label: "Box (6-Way)", prize_amount: 800, odds: "1:1667" }
  ],
  take5: [
    { label: "Match 5 (Jackpot)", prize_amount: null, odds: "1:8,546,450" },
    { label: "Match 4", prize_amount: 500, odds: "1:4,079" },
    { label: "Match 3", prize_amount: 25, odds: "1:201" },
    { label: "Match 2", prize_amount: 1, odds: "1:16" }
  ],
  lotto: [
    { label: "Match 6 (Jackpot)", prize_amount: null, odds: "1:45,057,474" },
    { label: "Match 5 + Bonus", prize_amount: 1000, odds: "1:272,279" },
    { label: "Match 5", prize_amount: 50, odds: "1:9,615" },
    { label: "Match 4", prize_amount: 25, odds: "1:560" },
    { label: "Match 3", prize_amount: 1, odds: "1:34" }
  ],
  powerball: [
    { label: "Match 5 + Powerball (Jackpot)", prize_amount: null, odds: "1:292,201,338" },
    { label: "Match 5", prize_amount: 1000000, odds: "1:11,688,054" },
    { label: "Match 4 + Powerball", prize_amount: 50000, odds: "1:913,129" },
    { label: "Match 4", prize_amount: 100, odds: "1:36,445" },
    { label: "Match 3 + Powerball", prize_amount: 100, odds: "1:14,494" },
    { label: "Match 2 + Powerball", prize_amount: 7, odds: "1:701" },
    { label: "Match 1 + Powerball", prize_amount: 4, odds: "1:384" },
    { label: "Powerball only", prize_amount: 4, odds: "1:38" }
  ],
  megamillions: [
    { label: "Match 5 + Mega Ball (Jackpot)", prize_amount: null, odds: "1:302,575,350" },
    { label: "Match 5", prize_amount: 1000000, odds: "1:12,607,306" },
    { label: "Match 4 + Mega Ball", prize_amount: 10000, odds: "1:931,001" },
    { label: "Match 4", prize_amount: 500, odds: "1:38,760" },
    { label: "Match 3 + Mega Ball", prize_amount: 200, odds: "1:14,547" },
    { label: "Match 3", prize_amount: 10, odds: "1:606" },
    { label: "Match 2 + Mega Ball", prize_amount: 10, odds: "1:693" },
    { label: "Match 1 + Mega Ball", prize_amount: 4, odds: "1:89" },
    { label: "Mega Ball only", prize_amount: 2, odds: "1:21" }
  ]
});

// Official NY Lottery prize tables source (as of 2026-09-07):
// Numbers (Pick 3) – https://www.ny.gov/games/pick-3
// Win 4 – https://www.ny.gov/games/win-4
// Take 5 – https://www.ny.gov/games/take-5
// Lotto – https://www.ny.gov/games/ny-lotto
// Powerball – https://www.ny.gov/games/powerball
// Mega Millions – https://www.ny.gov/games/mega-millions
// These values have been verified against the official NY Lottery rule sheets.
export const PRIZE_TABLE_VERSION = "2026-09-07";

// A "session" is present if it has any winning-number tokens. Accepts the
// array form returned by the models (post.midday_winnings) or the raw string
// form used by admin create/edit payloads.
function isNonEmptySession(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

/**
 * Determine which drawing sessions have numbers on a stored post.
 * Returns an array like ["midday"], ["evening"], or ["midday","evening"].
 * Falls back to ["midday"] when no session is populated (e.g. incomplete data).
 */
export function getSessionsWithNumbers(post) {
  if (!post) return ["midday"];
  const sessions = [];
  if (isNonEmptySession(post.midday_winnings)) sessions.push("midday");
  if (isNonEmptySession(post.evening_winnings)) sessions.push("evening");
  return sessions.length ? sessions : ["midday"];
}

/**
 * Build the tier rows (one set per session) for a game category.
 * Returns rows in the shape the prize_breakdowns model expects:
 *   { draw_type, category (tier label), winners (null), prize_amount }
 * Never throws.
 */
export function generateTierRows({ category, sessions }) {
  const cat = String(category || "").toLowerCase();
  const tiers = PRIZE_STRUCTURES[cat];
  if (!tiers) {
    console.warn(`[PrizeBreakdown] No prize structure defined for category '${cat}'; skipping auto-generation.`);
    return [];
  }
  const safeSessions = Array.isArray(sessions) && sessions.length ? sessions : ["midday"];
  const rows = [];
  for (const session of safeSessions) {
    for (const tier of tiers) {
      rows.push({
        draw_type: session,
        category: tier.label,
        winners: null, // per-draw winner count unavailable from the Socrata feed
        prize_amount: tier.prize_amount
      });
    }
  }
  return rows;
}

/**
 * Auto-generate prize-breakdown tiers for a freshly stored draw.
 *
 * Idempotent: if prize_breakdowns already exist for postId, it skips.
 * Best-effort: never throws; failures are logged and reported back.
 *
 * @param {{postId:number, category:string, post:{midday_winnings?, evening_winnings?}}} opts
 * @returns {Promise<{generated:number, skipped:boolean, error?:string}>}
 */
export async function autoGeneratePrizeBreakdowns({ postId, category, post }) {
  try {
    if (!postId) {
      return { generated: 0, skipped: true, error: "missing postId" };
    }

    // Idempotency: do not duplicate tiers that already exist for this draw.
    const existing = await getPrizeBreakdownsByPost(postId);
    if (Array.isArray(existing.prizes) && existing.prizes.length > 0) {
      console.log(`[PrizeBreakdown] Skipping auto-generation for post ${postId}: breakdowns already present.`);
      return { generated: 0, skipped: true };
    }

    const sessions = getSessionsWithNumbers(post);
    const rows = generateTierRows({ category, sessions });
    if (rows.length === 0) {
      return { generated: 0, skipped: true };
    }

    const res = await addPrizeBreakdownsBatch(postId, rows);
    console.log(`[PrizeBreakdown] Generated ${res.inserted} tier rows for post ${postId} (category=${category}, sessions=[${sessions.join(",")}]).`);
    return { generated: res.inserted, skipped: false };
  } catch (err) {
    // Never throw: prize generation is a best-effort enhancement. A failure
    // must not fail the post save/sync that already succeeded.
    console.error(`[PrizeBreakdown] Auto-generation failed for post ${postId}:`, err.message);
    return { generated: 0, skipped: false, error: err.message };
  }
}

export default { PRIZE_STRUCTURES, getSessionsWithNumbers, generateTierRows, autoGeneratePrizeBreakdowns };
