/**
 * Royal Mail Click & Drop API.
 *
 * Register for API access from within Click & Drop (Settings > Shipping >
 * API integrations) — Royal Mail issues a client id + API key once approved.
 *
 * NOTE: verify the current auth header names and payload shape against
 * https://developer.royalmail.net (or the Click & Drop API docs linked from
 * your Click & Drop account) before going live — Royal Mail has changed
 * these before, and access is approved per-account.
 */

const ROYAL_MAIL_API_BASE = "https://api.parcel.royalmail.com/api/v1";

export function royalMailConfigured() {
  return !!process.env.ROYAL_MAIL_CLIENT_ID && !!process.env.ROYAL_MAIL_API_KEY;
}

import type { ShippingAddress, CreatedLabel } from "./ups";

export async function createRoyalMailShipment(params: {
  shipTo: ShippingAddress;
  reference: string;
}): Promise<CreatedLabel> {
  const payload = {
    items: [
      {
        orderReference: params.reference,
        recipient: {
          address: {
            fullName: params.shipTo.name,
            addressLine1: params.shipTo.line1,
            addressLine2: params.shipTo.line2,
            city: params.shipTo.city,
            postcode: params.shipTo.postalCode,
            countryCode: params.shipTo.countryCode,
          },
          phoneNumber: params.shipTo.phone,
        },
        packageFormat: "parcel",
        weightInGrams: 500,
        postageDetails: { sendNotificationsTo: "recipient" },
      },
    ],
  };

  const res = await fetch(`${ROYAL_MAIL_API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ROYAL_MAIL_API_KEY}`,
      "X-Client-Id": process.env.ROYAL_MAIL_CLIENT_ID ?? "",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Royal Mail shipment creation failed: ${await res.text()}`);
  const data = await res.json();
  const created = data.createdOrders?.[0] ?? data.orders?.[0];

  return {
    trackingNumber: created?.trackingNumber ?? created?.orderIdentifier,
    labelUrl: created?.label?.url,
    carrier: "ROYAL_MAIL" as const,
  };
}

import type { TrackingEvent } from "./ups";

/**
 * Live tracking lookup via Royal Mail's tracking API. Returns Royal Mail's
 * own current status text as-is, same reasoning as the UPS equivalent.
 *
 * NOTE: Royal Mail's tracking API is a separate product/subscription from
 * Click & Drop shipping — confirm what's included on your account and the
 * current endpoint/auth shape at developer.royalmail.net before going live.
 */
export async function getRoyalMailTracking(trackingNumber: string): Promise<TrackingEvent> {
  const res = await fetch(`https://api.royalmail.net/mailpieces/v2/${encodeURIComponent(trackingNumber)}/events`, {
    headers: {
      "X-IBM-Client-Id": process.env.ROYAL_MAIL_CLIENT_ID ?? "",
      "X-IBM-Client-Secret": process.env.ROYAL_MAIL_API_KEY ?? "",
    },
  });
  if (!res.ok) throw new Error(`Royal Mail tracking lookup failed: ${await res.text()}`);
  const data = await res.json();
  const latest = data.mailPieces?.summary?.lastEventName ?? data.mailPieces?.events?.[0]?.eventName ?? "Unknown";
  return { status: latest, description: latest, occurredAt: data.mailPieces?.summary?.lastEventDateTime };
}
