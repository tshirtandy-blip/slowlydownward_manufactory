import { prisma } from "@/lib/prisma";
import { getSiteSettings, SITE_SETTINGS_ID } from "@/lib/site-settings";

/**
 * Resend Broadcasts — marketing/newsletter email, separate from
 * src/lib/integrations/resend.ts (transactional email: order confirmations,
 * payment links, welcome). Same API key and sending domain, different part
 * of Resend's API (Segments/Contacts/Broadcasts rather than /emails).
 * Docs: https://resend.com/docs/api-reference/broadcasts/create-broadcast
 *
 * Replaces the campaign-sending half of Mailchimp (Admin > Settings >
 * Integrations still shows Mailchimp for the moment; see Admin > Campaigns).
 *
 * Two standing Resend Segments are the whole audience model here — see
 * SiteSettings.resendSegmentAllId / resendSegmentCustomersId:
 *   - "all": everyone with Customer.marketingOptIn = true
 *   - "customers": the same, narrowed to people who've placed an order
 * Both are created on first use (getMarketingSegments) and kept in sync
 * incrementally at the two moments someone's marketing status changes —
 * newsletter signup (src/lib/newsletter.ts) and a completed order (the
 * Stripe webhook) — never resynced in bulk on every campaign send, since
 * pushing thousands of contacts in one request would blow past Vercel's
 * function time limit. A one-off historical import (e.g. from Mailchimp)
 * is a separate, deliberately-run backfill, not something this file does
 * automatically.
 */

const API_BASE = "https://api.resend.com";

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function resendBroadcastsConfigured() {
  return getConfig() !== null;
}

async function resendFetchRaw(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: any }> {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Email isn't set up yet — add RESEND_API_KEY and RESEND_FROM_EMAIL to your .env file, then restart the server."
    );
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  // A successful DELETE (or similar) can come back with an empty body.
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, body };
}

async function resendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { ok, status, body } = await resendFetchRaw(path, init);
  if (!ok) {
    throw new Error(`Resend ${init?.method ?? "GET"} ${path} failed (${status}): ${JSON.stringify(body)}`);
  }
  return body as T;
}

/** Creates (once) and returns the two standing Segment ids, caching them on
 * SiteSettings so this only ever happens the first time a campaign — or
 * the newsletter/order sync — needs one. */
export async function getMarketingSegments(): Promise<{ allId: string; customersId: string }> {
  // getSiteSettings() guarantees the one singleton row exists (creating it
  // from defaults the first time anything needs it) — same row Admin >
  // Settings reads/writes everywhere else, so we just add to it here
  // rather than managing our own.
  const settings = await getSiteSettings();

  let allId = settings.resendSegmentAllId;
  let customersId = settings.resendSegmentCustomersId;

  if (!allId) {
    const created = await resendFetch<{ id: string }>("/segments", {
      method: "POST",
      body: JSON.stringify({ name: "Slowly Downward — all marketing contacts" }),
    });
    allId = created.id;
  }
  if (!customersId) {
    const created = await resendFetch<{ id: string }>("/segments", {
      method: "POST",
      body: JSON.stringify({ name: "Slowly Downward — customers" }),
    });
    customersId = created.id;
  }

  if (allId !== settings.resendSegmentAllId || customersId !== settings.resendSegmentCustomersId) {
    await prisma.siteSettings.update({
      where: { id: SITE_SETTINGS_ID },
      data: { resendSegmentAllId: allId, resendSegmentCustomersId: customersId },
    });
  }

  return { allId, customersId };
}

/** Adds or updates a contact and puts them in the "all" segment, plus
 * "customers" too when isCustomer is true — called from newsletter signup
 * (isCustomer always false there) and from the Stripe webhook once an
 * order completes (isCustomer true). Never removes a segment membership a
 * contact already has (so someone who's already a customer and re-submits
 * the newsletter form doesn't fall out of "customers") — each segment is
 * added to individually via the dedicated add-to-segment endpoint, rather
 * than replacing a contact's segment list wholesale. Unsubscribing is
 * handled by Resend itself (every broadcast includes an unsubscribe link)
 * and reported back via the email.* webhooks, not by this function. */
export async function upsertResendContact(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  isCustomer: boolean;
}): Promise<string | null> {
  if (!resendBroadcastsConfigured()) {
    console.warn("Resend Broadcasts not configured — skipping contact sync for", params.email);
    return null;
  }

  const { allId, customersId } = await getMarketingSegments();
  const encodedEmail = encodeURIComponent(params.email);

  const existing = await resendFetchRaw(`/contacts/${encodedEmail}`);
  let contactId: string;
  if (existing.ok) {
    contactId = existing.body.id;
    if (params.firstName || params.lastName) {
      await resendFetch(`/contacts/${encodedEmail}`, {
        method: "PATCH",
        body: JSON.stringify({
          first_name: params.firstName || undefined,
          last_name: params.lastName || undefined,
        }),
      });
    }
  } else {
    const created = await resendFetch<{ id: string }>("/contacts", {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        first_name: params.firstName || undefined,
        last_name: params.lastName || undefined,
      }),
    });
    contactId = created.id;
  }

  await resendFetch(`/contacts/${encodedEmail}/segments/${allId}`, { method: "POST" });
  if (params.isCustomer) {
    await resendFetch(`/contacts/${encodedEmail}/segments/${customersId}`, { method: "POST" });
  }

  return contactId;
}

/** Live count of who a campaign would go to right now, from our own data —
 * shown on the compose page. The actual send targets the standing Resend
 * segment, which tracks this closely but not instantly (a signup or order
 * in the last few seconds may not have synced yet). */
export async function estimateRecipientCount(audience: "ALL" | "CUSTOMERS"): Promise<number> {
  if (audience === "CUSTOMERS") {
    return prisma.customer.count({ where: { marketingOptIn: true, orders: { some: {} } } });
  }
  return prisma.customer.count({ where: { marketingOptIn: true } });
}

/** Creates a broadcast as a draft against the chosen standing segment.
 * Doesn't send it — sendBroadcast (below) does that as a separate step,
 * once the caller has recorded the campaign row and recipient snapshot. */
export async function createBroadcast(params: {
  subject: string;
  html: string;
  audience: "ALL" | "CUSTOMERS";
}): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error("Resend isn't configured.");
  const { allId, customersId } = await getMarketingSegments();
  const segmentId = params.audience === "CUSTOMERS" ? customersId : allId;

  const broadcast = await resendFetch<{ id: string }>("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      segment_id: segmentId,
      from: config.from,
      subject: params.subject,
      html: params.html,
    }),
  });
  return broadcast.id;
}

/** Sends (or schedules) a broadcast that's already been created. Pass an
 * ISO 8601 timestamp to schedule it, or omit scheduledAtIso to send now. */
export async function sendBroadcast(broadcastId: string, scheduledAtIso?: string): Promise<void> {
  await resendFetch(`/broadcasts/${broadcastId}/send`, {
    method: "POST",
    body: JSON.stringify(scheduledAtIso ? { scheduled_at: scheduledAtIso } : {}),
  });
}

/** Cancels a scheduled (not-yet-sent) broadcast — used when a scheduled
 * campaign is cancelled from the admin before its send time arrives. */
export async function cancelBroadcast(broadcastId: string): Promise<void> {
  await resendFetch(`/broadcasts/${broadcastId}`, { method: "DELETE" });
}
