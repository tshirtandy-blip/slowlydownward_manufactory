import crypto from "crypto";

/**
 * Mailchimp Marketing API v3.
 * Auth: API key looks like "abcdef123456-us21" — the part after the last
 * hyphen ("us21") is the data-centre / server prefix and is part of the
 * base URL. Basic auth with any username works, password = API key.
 * Docs: https://mailchimp.com/developer/marketing/api/
 */

function getConfig() {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!apiKey || !audienceId) return null;
  const server = apiKey.split("-").pop();
  return { apiKey, audienceId, server };
}

export function mailchimpConfigured() {
  return getConfig() !== null;
}

/**
 * Adds or updates a subscriber on the store's audience. Uses the
 * "upsert by MD5(lowercase email)" pattern the Mailchimp API expects for
 * PUT /lists/{list_id}/members/{subscriber_hash}.
 */
export async function upsertMailchimpMember(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  marketingOptIn: boolean;
  tags?: string[];
  mergeFields?: Record<string, string | number>;
}) {
  const config = getConfig();
  if (!config) {
    console.warn("Mailchimp not configured — skipping sync for", params.email);
    return null;
  }

  const subscriberHash = crypto.createHash("md5").update(params.email.toLowerCase()).digest("hex");
  const url = `https://${config.server}.api.mailchimp.com/3.0/lists/${config.audienceId}/members/${subscriberHash}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${config.apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: params.email,
      status_if_new: params.marketingOptIn ? "subscribed" : "transactional",
      merge_fields: {
        FNAME: params.firstName ?? "",
        LNAME: params.lastName ?? "",
        ...params.mergeFields,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailchimp upsert failed (${res.status}): ${body}`);
  }
  const member = await res.json();

  if (params.tags?.length) {
    await fetch(`${url}/tags`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${config.apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags: params.tags.map((name) => ({ name, status: "active" })) }),
    });
  }

  return member;
}
