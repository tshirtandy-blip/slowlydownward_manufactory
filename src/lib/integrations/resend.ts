/**
 * Transactional email via Resend (https://resend.com) — currently used only
 * for one thing: emailing a client the payment link for a manual order
 * (Admin > Orders > New manual order). Nothing else in the app sends real
 * email yet; general order/shipping notification emails are a separate,
 * later piece of work.
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
