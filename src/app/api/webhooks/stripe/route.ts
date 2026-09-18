import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { allocateEdition } from "@/lib/editions";
import { upsertMailchimpMember, mailchimpConfigured } from "@/lib/integrations/mailchimp";
import { upsertResendContact, resendBroadcastsConfigured } from "@/lib/integrations/resend-broadcasts";
import { createXeroInvoiceForOrder, xeroConfigured } from "@/lib/integrations/xero";
import { sendEmail, emailConfigured } from "@/lib/integrations/resend";
import { renderOrderConfirmationEmail } from "@/lib/email-templates";
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
          include: { items: { include: { print: true } } },
        });

        if (order.status !== "PENDING_PAYMENT") return; // already processed (webhook retried)

        for (const item of order.items) {
          // Open editions (Print.editionSize === null) aren't limited or
          // numbered, so there are no Edition rows to allocate — this item
          // is fulfilled with no specific copy assigned, on purpose, rather
          // than treated as a fulfillment failure.
          if (item.print.editionSize === null) continue;
          const { edition, mismatch } = await allocateEdition(
            tx,
            item.printId,
            item.requestedEditionNumber,
            item.reservationToken
          );
          await tx.orderItem.update({ where: { id: item.id }, data: { editionId: edition.id } });

          // The customer's requested number couldn't be honoured — record
          // exactly why, right on the order, so a future "I got the wrong
          // number" report can be looked into with hard evidence instead of
          // reconstructing it after the fact from a screenshot.
          if (mismatch) {
            await tx.auditLog.create({
              data: {
                action: "requested_edition_unavailable",
                entityType: "Order",
                entityId: orderId,
                meta: {
                  orderItemId: item.id,
                  printId: item.printId,
                  requestedNumber: item.requestedEditionNumber,
                  assignedNumber: edition.number,
                  reason: mismatch.reason,
                  editionStatusAtCheckTime: mismatch.editionStatus,
                  heldByToken: mismatch.heldByToken,
                  thisOrdersToken: item.reservationToken,
                },
              },
            });
          }
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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { print: true, edition: true } } },
    });
    if (order) {
      if (emailConfigured()) {
        try {
          const { subject, html } = await renderOrderConfirmationEmail({
            customerName: order.customer.firstName || "there",
            orderNumber: order.orderNumber,
            items: order.items.map((i) => ({
              title: i.print.title,
              editionNumber: i.edition?.number ?? null,
              priceMinor: i.unitPriceMinor,
              currency: order.currency,
            })),
            subtotalMinor: order.subtotalMinor,
            shippingMinor: order.shippingMinor,
            totalMinor: order.totalMinor,
            currency: order.currency,
          });
          await sendEmail({ to: order.customer.email, subject, html });
        } catch (err) {
          await logFailure(orderId, "order_confirmation_email_failed", err);
        }
      }
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
      // Only when they've actually opted into marketing — an order alone
      // shouldn't land someone in a segment campaigns get sent to (Admin >
      // Campaigns) any more than it should mark them subscribed in
      // Mailchimp above (that call's own "transactional" status covers the
      // not-opted-in case for Mailchimp; this one just skips entirely).
      if (resendBroadcastsConfigured() && order.customer.marketingOptIn) {
        try {
          const resendContactId = await upsertResendContact({
            email: order.customer.email,
            isCustomer: true,
          });
          if (resendContactId) {
            await prisma.customer.update({ where: { id: order.customer.id }, data: { resendContactId } });
          }
        } catch (err) {
          await logFailure(orderId, "resend_sync_failed", err);
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
