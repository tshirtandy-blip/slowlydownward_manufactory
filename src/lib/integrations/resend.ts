/**
 * Transactional email via Resend (https://resend.com) — sends the payment
 * link for a manual order, the storefront order confirmation, and the new
 * account welcome email. The actual wording for all of these is admin-
 * editable (Admin > Settings > Emails, see src/lib/email-templates.ts);
 * this file only knows how to hand a rendered subject/html off to Resend.
 *
 * Setup (see README): sign up at resend.com, verify a sending domain (or
 * use their shared test domain while you're just trying this out), create
 * an API key, then set RESEND_API_KEY and RESEND_FROM_EMAIL in your .env
 * file and restart the server.
 */

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function emailConfigured() {
  return getConfig() !== null;
}

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Email isn't set up yet — add RESEND_API_KEY and RESEND_FROM_EMAIL to your .env file, then restart the server."
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }

  return res.json();
}
