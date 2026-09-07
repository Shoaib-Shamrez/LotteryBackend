// utils/emailService.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // Your Gmail
      pass: process.env.EMAIL_PASS, // App Password (not regular password!)
    },
  });
};

// Email template for new post notification
const createEmailTemplate = (post, postUrl, subscriberName) => {
  const { title, category, date, description } = post;
  const baseUrl = (process.env.APP_URL || process.env.BASE_URL || "https://nylotteryresults.com").replace(/\/$/, "");
  const unsubscribeUrl = `${baseUrl}/unsubscribe`;

  return {
    subject: `🎰 New ${category} Results - ${title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #004990; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background: #f9f9f9; border: 1px solid #ddd; }
          .post-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #004990; }
          .post-meta { color: #666; margin-bottom: 20px; font-size: 14px; }
          .cta-button { 
            display: inline-block; 
            background: #004990; 
            color: white !important; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
            font-weight: bold;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f0f0f0; border-radius: 0 0 8px 8px; }
          .divider { border-top: 2px solid #004990; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🎰 New Lottery Results!</h1>
          </div>
          <div class="content">
            <p>Hi ${subscriberName || "there"},</p>
            <p>We've just published the latest lottery results you've been waiting for!</p>
            
            <div class="divider"></div>
            
            <h2 class="post-title">${title}</h2>
            <div class="post-meta">
              <strong>Category:</strong> ${category}<br>
              <strong>Draw Date:</strong> ${new Date(
                date
              ).toLocaleDateString()}<br>
            </div>
            
            ${description ? `<p>${description}</p>` : ""}
            
            <div style="text-align: center;">
              <a href="${postUrl}" class="cta-button">
                View Full Results →
              </a>
            </div>
            
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              Click the button above to see the complete winning numbers, prize breakdown, and more details.
            </p>
          </div>
          <div class="footer">
            <p>You received this email because you subscribed to lottery results updates.</p>
            <p style="margin-top: 10px;">
              <a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
New ${category} Results - ${title}

Hi ${subscriberName || "there"},

We've just published the latest lottery results!

Category: ${category}
Draw Date: ${new Date(date).toLocaleDateString()}

${description || ""}

View full results: ${postUrl}

You received this email because you subscribed to lottery results updates.
Unsubscribe: ${unsubscribeUrl}
    `,
  };
};

/**
 * Masks an email address for privacy-safe logging (e.g. "alice@example.com" -> "a***e@example.com").
 * @param {string} email
 * @returns {string} Masked email
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0] || "*"}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

// Send email to a single subscriber
const sendEmailToSubscriber = async (subscriber, post, postUrl) => {
  const transporter = createTransporter();
  const emailContent = createEmailTemplate(post, postUrl, subscriber.name);

  const mailOptions = {
    from: `"Lottery Results Hub" <${process.env.EMAIL_USER}>`,
    to: subscriber.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent to ${maskEmail(subscriber.email)}: ${info.messageId}`);
    return { success: true, email: subscriber.email };
  } catch (error) {
    console.error(
      `✗ Failed to send email to ${maskEmail(subscriber.email)}:`,
      error.message
    );
    return { success: false, email: subscriber.email, error: error.message };
  }
};

// Send emails to all subscribers (fire and forget)
export const sendPostNotificationEmails = async (
  post,
  subscribers,
  postUrl
) => {
  console.log(`\n📧 Starting email notification for post: "${post.title}"`);
  console.log(`   Sending to ${subscribers.length} subscribers...\n`);

  const results = {
    total: subscribers.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  // Send emails in batches to avoid overwhelming the email service
  const BATCH_SIZE = 10;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((subscriber) =>
        sendEmailToSubscriber(subscriber, post, postUrl)
      )
    );

    batchResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(result.value || result.reason);
      }
    });

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📧 Email Summary:`);
  console.log(`   ✓ Sent: ${results.sent}/${results.total}`);
  console.log(`   ✗ Failed: ${results.failed}/${results.total}\n`);

  return results;
};

/**
 * Triggers live subscriber notifications for a newly created draw post.
 * Non-blocking, fire-and-forget, best-effort. Will not throw or interrupt caller.
 *
 * @param {Object} opts
 * @param {string} opts.category
 * @param {string} opts.date
 * @param {string} [opts.title]
 * @param {string} [opts.description]
 * @returns {Promise<void>}
 */
export const triggerLiveSubscriberNotifications = async ({
  category,
  date,
  title,
  description
}) => {
  try {
    const { getAllSubscribers } = await import("../models/subscriberModel.js");
    const subscribers = await getAllSubscribers().catch((err) => {
      console.warn("[Live Notifications] Could not fetch subscribers:", err.message);
      return [];
    });

    if (!subscribers || subscribers.length === 0) {
      console.log(`[Live Notifications] No subscribers found for ${category} draw on ${date}`);
      return;
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("[Live Notifications] Email credentials (EMAIL_USER / EMAIL_PASS) not configured. Skipping notifications.");
      return;
    }

    const baseUrl = (process.env.APP_URL || process.env.BASE_URL || "https://nylotteryresults.com").replace(/\/$/, "");
    const formattedDate = new Date(date).toISOString().split("T")[0];
    const categorySlug = category.toLowerCase().replace(/\s+/g, "-");
    const postUrl = `${baseUrl}/${categorySlug}/results/${formattedDate}`;

    const postData = {
      title: title || `${category} Results for ${date}`,
      category,
      date,
      description: description || `Check the latest winning numbers for ${category} drawing on ${date}.`
    };

    // Fire and forget - don't await blocking execution
    sendPostNotificationEmails(postData, subscribers, postUrl).catch((err) => {
      console.error("[Live Notifications] Email dispatch error:", err.message);
    });
  } catch (err) {
    console.error("[Live Notifications] Unexpected error:", err.message);
  }
};

// Test email configuration
export const testEmailConfig = async () => {
  const transporter = createTransporter();
  try {
    await transporter.verify();
    console.log("✓ Email configuration is valid");
    return true;
  } catch (error) {
    console.error("✗ Email configuration error:", error.message);
    return false;
  }
};
