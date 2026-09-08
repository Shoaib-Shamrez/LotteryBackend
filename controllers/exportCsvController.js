import { getPostById } from "../models/postModel.js";
import { getLatestJackpotByCategory } from "../models/jackpotModel.js";
import { getPrizeBreakdownsByPost } from "../models/prizeBreakModel.js";
import { normalizeDate } from "../utils/dateUtils.js";
import { generateCsv } from "../utils/csvExport.js";

/**
 * GET /api/posts/:id/export?format=csv
 * Returns a CSV representation of the draw.
 */
export const exportCsvHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query;

    // ID validation: positive integer
    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    // Format validation
    if (format !== "csv") {
      return res.status(400).json({ error: "Unsupported format" });
    }

    // Fetch post
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const postDateNorm = normalizeDate(post.date);
    const category = post.category;

    // Historical jackpot matching
    let jackpotAmount = "";
    try {
      const jackpotRows = await getLatestJackpotByCategory(category);
      if (jackpotRows && jackpotRows.length) {
        const jackpot = jackpotRows[0];
        const jackpotDateNorm = normalizeDate(jackpot.draw_date);
        if (jackpotDateNorm === postDateNorm && jackpot.jackpot_category === category) {
          jackpotAmount = jackpot.amount;
        }
      }
    } catch (e) {
      // ignore jackpot errors – treat as no jackpot
    }

    // Prize breakdowns
    const { prizes, totals } = await getPrizeBreakdownsByPost(postId);

    // Determine sessions with numbers
    const sessions = [];
    if (Array.isArray(post.midday_winnings) && post.midday_winnings.length) sessions.push("midday");
    if (Array.isArray(post.evening_winnings) && post.evening_winnings.length) sessions.push("evening");
    if (!sessions.length) sessions.push("midday"); // fallback

    // Build CSV rows
    const headers = [
      "category",
      "draw_date",
      "session",
      "numbers",
      "jackpot",
      "prize_tier",
      "winners",
      "prize_amount",
    ];

    const rows = [];

    for (const session of sessions) {
      const numbersArray = session === "midday" ? post.midday_winnings : post.evening_winnings;
      const numbersStr = Array.isArray(numbersArray) ? numbersArray.join(", ") : "";

      // Filter prize rows for this session
      const sessionPrizes = prizes.filter((p) => p.draw_type === session);

      if (sessionPrizes.length) {
        for (const p of sessionPrizes) {
          rows.push([
            category,
            postDateNorm,
            session,
            numbersStr,
            jackpotAmount,
            p.category,
            p.winners ?? "",
            p.prize_amount ?? "",
          ]);
        }
      } else {
        // No prize rows – single draw‑level row
        rows.push([
          category,
          postDateNorm,
          session,
          numbersStr,
          jackpotAmount,
          "",
          "",
          "",
        ]);
      }
    }

    const csvContent = await generateCsv(rows, headers);
    const filename = `${category}-${postDateNorm}${sessions.length === 1 ? `-${sessions[0]}` : ""}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (err) {
    console.error("CSV export error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
