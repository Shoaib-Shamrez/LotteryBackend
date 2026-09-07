import { NYOpenDataProvider } from "./provider.js";
import { IngestionValidator } from "./validator.js";
import { getPostByCategoryAndDate, createPost, updatePost } from "../../models/postModel.js";
import { createSyncLog } from "../../models/syncLogModel.js";
import { GAME_NAMES, generateSeoFields } from "../../utils/seoService.js";
import { bustSitemapCache } from "../../utils/sitemapService.js";
import { autoGeneratePrizeBreakdowns } from "../prizeBreakdownService.js";
import { triggerLiveSubscriberNotifications } from "../../utils/emailService.js";

export class IngestionSyncEngine {
  constructor() {
    this.provider = new NYOpenDataProvider();
    this.validator = new IngestionValidator();
  }

  /**
   * Syncs draw results for a given category and optional date.
   * Backward-compatible single-shot API; delegates to syncSingle with no runId.
   *
   * @param {string} category
   * @param {string} [date]
   * @param {boolean} [dryRun=false]
   * @returns {Promise<Object>} Execution report
   */
  async sync(category, date, dryRun = false) {
    return this.syncSingle(category, date, dryRun, null);
  }

  /**
   * Syncs draw results for a given category and optional date and persists
   * a sync_logs row linked to the optional sync_runs.runId.
   *
   * This is the single owner of sync_log creation. Controllers must not write
   * sync_logs directly.
   *
   * @param {string} category
   * @param {string} [date]
   * @param {boolean} [dryRun=false]
   * @param {number|null} [runId=null]  Optional parent sync_run id.
   * @param {AbortSignal} [signal]  Optional abort signal (scheduled runs use
   *   this so that a run-deadline timeout can prevent unsafe late DB writes
   *   such as sync_logs, post create/update, or prize breakdowns). Manual/retry
   *   runs pass no signal.
   * @returns {Promise<Object>} Execution report (with logId).
   */
  async syncSingle(category, date, dryRun = false, runId = null, signal) {
    const startTime = Date.now();
    const cat = category.toLowerCase();
    const report = {
      success: true,
      category: cat,
      date: date || "latest",
      fetched: 0,
      validated: 0,
      created: 0,
      updated: 0,
      duplicates: 0,
      corrections: 0,
      prizeBreakdownsGenerated: 0,
      errors: [],
      details: [],
      durationMs: 0,
      runId
    };

    console.log(`[Sync Engine] Starting sync for category: ${cat}, date: ${date || "latest"}${dryRun ? " (DRY RUN)" : ""}`);

    const aborted = () => signal && signal.aborted;

    try {
      const rawRecords = await this.provider.fetchRawResults(cat, date);
      report.fetched = rawRecords.length;

      // After provider fetch returns, check whether the run-deadline has
      // already expired before performing ANY database writes.
      if (aborted()) {
        report.success = false;
        report.errors.push("Sync aborted before DB writes (run deadline exceeded)");
        report.durationMs = Date.now() - startTime;
        return report;
      }

      // Handle empty provider result
      if (report.fetched === 0) {
        report.message = "No draws found for the requested category/date";
        report.durationMs = Date.now() - startTime;
        if (!aborted()) {
          // Persist sync log for empty result
          try {
            const logId = await createSyncLog(report, runId);
            report.logId = logId;
          } catch (logErr) {
            console.error('[Sync Engine] Failed to persist sync log (empty result):', logErr);
          }
        }
        return report;
      }

      for (const raw of rawRecords) {
        // Check abort signal at the top of each record iteration so we bail
        // before any further DB writes once the run-deadline fires.
        if (aborted()) {
          report.success = false;
          report.errors.push("Sync aborted mid-iteration (run deadline exceeded)");
          break;
        }

        const drawDetails = {
          date: null,
          status: "processed",
          errors: []
        };

        try {
          // 1. Normalize
          const normalized = this.provider.normalize(cat, raw);
          drawDetails.date = normalized.drawDate;

          // 2. Validate
          const validation = this.validator.validate(normalized);
          if (!validation.isValid) {
            report.errors.push(...validation.errors.map(err => `[Date: ${normalized.drawDate}] ${err}`));
            drawDetails.status = "invalid";
            drawDetails.errors.push(...validation.errors);
            report.details.push(drawDetails);
            continue;
          }
          report.validated++;

          // 3. Lookup existing
          const existing = await getPostByCategoryAndDate(normalized.drawDate, cat);

          if (!existing) {
            // Create new record
            if (!dryRun) {
              // Check before createPost (DB write)
              if (aborted()) {
                report.success = false;
                report.errors.push("Sync aborted before post create (run deadline exceeded)");
                break;
              }
              const title = `${GAME_NAMES[cat]} Results for ${this.formatReadableDate(normalized.drawDate)}`;
              const description = `Check the winning numbers for ${GAME_NAMES[cat]} drawing on ${normalized.drawDate}.`;
              const { metaTitle, metaDescription } = generateSeoFields({
                category: cat,
                date: normalized.drawDate,
                middayWinningNumbers: normalized.middayWinningNumbers,
                eveningWinningNumbers: normalized.eveningWinningNumbers,
                title
              });

              const result = await createPost(
                title,
                cat,
                "published",
                normalized.drawDate,
                normalized.middayWinningNumbers,
                normalized.eveningWinningNumbers,
                description,
                metaTitle,
                metaDescription
              );
              drawDetails.id = result.id;
              drawDetails.metaAutoFilled = true;
              console.log(`[Sync Engine] Created post for ${cat} on ${normalized.drawDate} with ID: ${result.id}`);
              bustSitemapCache();

              // Check before prize breakdown generation (DB write)
              if (aborted()) {
                report.success = false;
                report.errors.push("Sync aborted before prize breakdown (run deadline exceeded)");
                break;
              }

              // Auto-generate the static prize-tier skeleton for the new draw.
              // Best-effort: never throws, so a failure cannot undo the post save.
              const prizeReport = await autoGeneratePrizeBreakdowns({
                postId: result.id,
                category: cat,
                post: {
                  midday_winnings: normalized.middayWinningNumbers,
                  evening_winnings: normalized.eveningWinningNumbers
                }
              });
              // Trigger live subscriber notifications (fire-and-forget, best-effort)
              triggerLiveSubscriberNotifications({
                category: cat,
                date: normalized.drawDate,
                title,
                description
              }).catch((err) => console.error("[Sync Engine] Live subscriber notification trigger error:", err.message));

              drawDetails.prizeBreakdownsGenerated = prizeReport.generated || 0;
              report.prizeBreakdownsGenerated += prizeReport.generated || 0;
            }
            report.created++;
            drawDetails.status = "created";
          } else {
            // Compare & Merge / Check Corrections
            const isMatch = this.compareNumbers(existing.midday_winnings, normalized.middayWinningNumbers) &&
                            this.compareNumbers(existing.evening_winnings, normalized.eveningWinningNumbers);

            if (isMatch) {
              report.duplicates++;
              drawDetails.status = "skipped_duplicate";
              console.log(`[Sync Engine] Duplicate draw found for ${cat} on ${normalized.drawDate} (identical numbers). Skipped.`);
            } else {
              // Check if we can safely update (i.e. merge new session numbers) or if it's a correction conflict
              const canMergeMidday = !existing.midday_winnings || existing.midday_winnings.length === 0;
              const canMergeEvening = !existing.evening_winnings || existing.evening_winnings.length === 0;

              const isIncomingMiddayNew = normalized.middayWinningNumbers && normalized.middayWinningNumbers.length > 0;
              const isIncomingEveningNew = normalized.eveningWinningNumbers && normalized.eveningWinningNumbers.length > 0;

              // If numbers exist in both and differ, it's a correction conflict
              const middayConflict = existing.midday_winnings && existing.midday_winnings.length > 0 && 
                                     isIncomingMiddayNew && 
                                     !this.compareNumbers(existing.midday_winnings, normalized.middayWinningNumbers);

              const eveningConflict = existing.evening_winnings && existing.evening_winnings.length > 0 && 
                                      isIncomingEveningNew && 
                                      !this.compareNumbers(existing.evening_winnings, normalized.eveningWinningNumbers);

              if (middayConflict || eveningConflict) {
                report.corrections++;
                drawDetails.status = "correction_detected";
                const errMsg = `Correction detected for ${cat} on ${normalized.drawDate}. DB Midday: [${existing.midday_winnings?.join(",")}], API Midday: [${normalized.middayWinningNumbers?.join(",")}]. DB Evening: [${existing.evening_winnings?.join(",")}], API Evening: [${normalized.eveningWinningNumbers?.join(",")}]. Manual review required.`;
                report.errors.push(errMsg);
                console.warn(`[Sync Engine] ${errMsg}`);
              } else {
                // Merge session winnings (e.g. DB had Midday, API brings Evening)
                if (!dryRun) {
                  // Check before updatePost (DB write)
                  if (aborted()) {
                    report.success = false;
                    report.errors.push("Sync aborted before post update (run deadline exceeded)");
                    break;
                  }
                  const updatedPostData = {
                    title: existing.title,
                    category: existing.category,
                    status: existing.status,
                    created_at: normalized.drawDate, // maps to created_at in model updatePost
                    content: existing.content,
                    meta_title: existing.meta_title,
                    meta_desc: existing.meta_desc,
                    midday_winnings: isIncomingMiddayNew ? normalized.middayWinningNumbers : existing.midday_winnings,
                    evening_winnings: isIncomingEveningNew ? normalized.eveningWinningNumbers : existing.evening_winnings
                  };

                  await updatePost(existing.id, updatedPostData);
                  console.log(`[Sync Engine] Merged/Updated post for ${cat} on ${normalized.drawDate} (ID: ${existing.id})`);
                  bustSitemapCache();
                }
                report.updated++;
                drawDetails.status = "updated_merged";
              }
            }
          }
        } catch (err) {
          report.errors.push(`[Date: ${drawDetails.date || "unknown"}] ${err.message}`);
          drawDetails.status = "failed";
          drawDetails.errors.push(err.message);
          console.error(`[Sync Engine] Record processing error:`, err);
        }

        report.details.push(drawDetails);
      }
    } catch (err) {
      report.success = false;
      report.errors.push(`Sync global failure: ${err.message}`);
      console.error(`[Sync Engine] Fatal sync error:`, err);
    }

    report.durationMs = Date.now() - startTime;

    // Check abort signal before the final sync_log write so we never create
    // a sync_logs row after the run has been finalized as timed-out/failed.
    if (aborted()) {
      report.success = false;
      report.errors.push("Sync aborted before final sync_log (run deadline exceeded)");
    } else {
      // Persist sync log (both success and failure)
      try {
        const logId = await createSyncLog(report, runId);
        report.logId = logId;
      } catch (logErr) {
        console.error('[Sync Engine] Failed to persist sync log:', logErr);
      }
    }
    return report;
  }

  /**
   * Helper to format YYYY-MM-DD into a human-readable date.
   */
  formatReadableDate(dateStr) {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  /**
   * Helper to compare two winning numbers arrays.
   */
  compareNumbers(arr1, arr2) {
    const a1 = Array.isArray(arr1) ? arr1 : [];
    const a2 = Array.isArray(arr2) ? arr2 : [];
    if (a1.length !== a2.length) return false;
    return a1.every((val, index) => String(val) === String(a2[index]));
  }
}
