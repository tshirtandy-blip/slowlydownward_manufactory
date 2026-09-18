import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Receives Resend's webhook events (Admin > Campaigns' "opens"/"clicks"
 * numbers, and automatic list cleaning, both come from here) — configure
 * this URL (https://<your-domain>/api/webhooks/resend) under Resend >
 * Webhooks, subscribed to at least email.opened, email.clicked,
 * email.bounced and email.complained, and set RESEND_WEBHOOK_SECRET to
 * the signing secret it gives you. Every event is stored as a
 * CampaignEvent row (raw payload kept, not just the fields we currently
 * use) whenever it's tied to a broadcast this app sent; events for
 * transactional email (order confirmations etc.) have no broadcast_id and
 * are just acknowledged and ignored.
 *
 * "Auto cleaning": a hard bounce or spam complaint turns off
 * Customer.marketingOptIn for that address, the same way a real
 * unsubscribe would — so the next campaign's recipient count (and the
 * standing Resend segments, which Resend itself also suppresses within)
 * doesn't keep counting an address that can't actually be reached.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Resend webhook received but RESEND_WEBHOOK_SECRET isn't set — refusing to process it.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  let event: { type: string; created_at?: string; data?: Record<string, any> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      "svix-id": svixId ?? "",
      "svix-timestamp": svixTimestamp ?? "",
      "svix-signature": svixSignature ?? "",
    }) as typeof event;
  } catch (err) {
    console.error("Resend webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const data = event.data ?? {};
  const broadcastId: string | undefined = data.broadcast_id;
  const recipient: string | undefined = Array.isArray(data.to) ? data.to[0] : data.to;

  if (broadcastId) {
    try {
      const campaign = await prisma.campaign.findFirst({ where: { resendBroadcastId: broadcastId } });
      if (campaign) {
        await prisma.campaignEvent.create({
          data: {
            campaignId: campaign.id,
            type: event.type,
            recipient: recipient ?? null,
            resendEmailId: data.email_id ?? null,
            payload: event as any,
          },
        });
      }
    } catch (err) {
      console.error("Failed to store Resend campaign event", err);
    }
  }

  if ((event.type === "email.bounced" || event.type === "email.complained") && recipient) {
    try {
      await prisma.customer.updateMany({
        where: { email: recipient.toLowerCase() },
        data: { marketingOptIn: false },
      });
    } catch (err) {
      console.error("Failed to suppress bounced/complained address", recipient, err);
    }
  }

  return NextResponse.json({ received: true });
}
