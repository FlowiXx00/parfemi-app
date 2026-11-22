import "server-only";

/**
 * Sends email through Resend (https://resend.com) with a plain HTTP call, no SDK.
 * If RESEND_API_KEY or EMAIL_FROM isn't set, emails are silently skipped
 * (the site works without them).
 *
 * .env.local:
 * RESEND_API_KEY=re_...
 * EMAIL_FROM="Atelier Dekant <porudzbine@your-domain.rs>" (the domain must be verified in Resend)
 * ADMIN_NOTIFY_EMAIL=you@example.com (receives new-order notifications)
 */

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(message: { to: string; subject: string; html: string; replyTo?: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from || !message.to) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("EMAIL nije poslat:", response.status, await response.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("EMAIL greška:", error);
    return false;
  }
}
