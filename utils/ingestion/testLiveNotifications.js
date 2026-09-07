// utils/ingestion/testLiveNotifications.js
//
// Pure unit tests for Feature 3.2 Live Subscriber Notifications.

import assert from "assert";
import { triggerLiveSubscriberNotifications, sendPostNotificationEmails, maskEmail } from "../emailService.js";

function testMaskEmailPrivacy() {
  console.log("Testing email privacy masking...");
  assert.strictEqual(maskEmail("alice@example.com"), "a***e@example.com");
  assert.strictEqual(maskEmail("shoaib@domain.com"), "s***b@domain.com");
  assert.strictEqual(maskEmail("hi@test.org"), "h***@test.org");
  assert.strictEqual(maskEmail(null), "***");
  assert.strictEqual(maskEmail("invalid"), "***");
  console.log("✓ maskEmail privacy transformation verified");
}

async function testEmailTemplateFormatting() {
  console.log("Testing live notifications helper & template formatting...");
  // Backup env
  const origAppUrl = process.env.APP_URL;
  const origBaseUrl = process.env.BASE_URL;

  process.env.APP_URL = "https://nylotteryresults.com";
  process.env.BASE_URL = "https://nylotteryresults.com";

  // Triggering live notifications without configured SMTP must be safe & non-blocking
  let error = null;
  try {
    await triggerLiveSubscriberNotifications({
      category: "take5",
      date: "2026-09-07",
      title: "New York Take 5 Results",
      description: "Winning numbers for Take 5"
    });
  } catch (err) {
    error = err;
  }

  assert.strictEqual(error, null, "triggerLiveSubscriberNotifications must not throw");
  console.log("✓ triggerLiveSubscriberNotifications non-blocking safety verified");

  // Restore env
  process.env.APP_URL = origAppUrl;
  process.env.BASE_URL = origBaseUrl;
}

async function testBatchEmailDispatch() {
  console.log("Testing batch subscriber notification dispatch logic...");
  const mockSubscribers = [
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob", email: "bob@example.com" }
  ];

  const mockPost = {
    title: "Test Draw Results",
    category: "numbers",
    date: "2026-09-07",
    description: "Daily Numbers winning draw."
  };

  const postUrl = "https://nylotteryresults.com/numbers/results/2026-09-07";

  // In environment without SMTP credentials, sendPostNotificationEmails completes
  // and records failed attempt metrics safely without throwing unhandled rejections.
  const summary = await sendPostNotificationEmails(mockPost, mockSubscribers, postUrl);
  assert.strictEqual(summary.total, 2, "Expected total subscribers to be 2");
  assert.strictEqual(summary.sent + summary.failed, 2, "Expected all items processed");
  console.log("✓ Batch email notification summary structure verified");
}

async function run() {
  console.log("--- Live Subscriber Notifications Unit Tests ---");
  testMaskEmailPrivacy();
  await testEmailTemplateFormatting();
  await testBatchEmailDispatch();
  console.log("🎉 All Live Subscriber Notifications Unit Tests PASSED!");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Live Subscriber Notifications tests failed:", err);
  process.exit(1);
});
