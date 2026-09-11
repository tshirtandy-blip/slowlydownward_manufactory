import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { allocateEdition } from "@/lib/editions";
import { upsertMailchimpMember, mailchimpConfigured } from "@/lib/integrations/mailchimp";
import { createXeroInvoiceForOrder, xeroConfigured } from "@/lib/integrations/xero";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

async function logFailure(orderId: string, action: string, error: unknown) {
  console.error(`[webhook] ${action} failed for order ${orderId}:`, error);
  await prisma.auditLog.create({
    data: {
      action,
      entityType: "Order",
      entityId: orderId,
      meta: { error: error instanceof Error ? error.message : String(error) },
    },
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      console.error("Checkout session completed with no orderId in metadata", session.id);
      return NextResponse.json({ received: true });
    }

    const shippingDetails = (session as any).shipping_details ?? session.customer_details;
    const shippingAddress = shippingDetails?.address ?? null;

    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { items: true },
        });

        if (order.status !== "PENDING_PAYMENT") return; // already processed (webhook retried)

        for (const item of order.items) {
          const edition = await allocateEdition(tx, item.printId, item.requestedEditionNumber);
          await tx.orderItem.update({ where: { id: item.id }, data: { editionId: edition.id } });
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
            totalMinor: session.amount_total ?? order.totalMinor,
            shippingMinor: session.shipping_cost?.amount_total ?? 0,
            shippingName: shippingDetails?.name ?? undefined,
            shippingAddress: shippingAddress as any,
          },
        });
      });
    } catch (err) {
      // Most likely cause: an edition sold out between checkout start and
      // payment completing (a race with another buyer). Refund and flag it.
      await logFailure(orderId, "fulfillment_failed", err);
      try {
        if (session.payment_intent) {
          await stripe.refunds.create({
            payment_intent:
              typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id,
          });
        }
        await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
      } catch (refundErr) {
        await logFailure(orderId, "auto_refund_failed", refundErr);
      }
      return NextResponse.json({ received: true });
    }

    // Side-effects: never let a failure here affect order fulfillment, which
    // has already succeeded above.
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
    if (order) {
      if (mailchimpConfigured()) {
        try {
          await upsertMailchimpMember({
            email: order.customer.email,
            marketingOptIn: order.customer.marketingOptIn,
            tags: ["customer"],
          });
          await prisma.order.update({ where: { id: orderId }, data: { mailchimpSynced: true } });
        } catch (err) {
          await logFailure(orderId, "mailchimp_sync_failed", err);
        }
      }
      if (xeroConfigured()) {
        try {
          await createXeroInvoiceForOrder(orderId);
        } catch (err) {
          await logFailure(orderId, "xero_invoice_failed", err);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
