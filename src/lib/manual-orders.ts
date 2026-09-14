import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { generateOrderNumber, formatMinor } from "@/lib/money";
import { getShippingZones, zoneForCountry } from "@/lib/shipping";
import { releaseExpiredReservations } from "@/lib/edition-reservations";
import { sendEmail } from "@/lib/integrations/resend";
import { countryName } from "@/lib/countries";

/**
 * Manual orders (Admin > Orders > New manual order) let staff sell a print
 * that isn't published on the storefront — archive stock, or a current
 * print reserved for a specific client — without the customer ever
 * visiting the site. The admin picks the exact edition number(s), the app
 * holds them (indefinitely — no browsing-style timer, unlike the
 * storefront) and creates a Stripe payment link, and emails it to the
 * client. Once they pay, this becomes an ordinary order: the same webhook
 * that handles storefront checkouts (src/app/api/webhooks/stripe/route.ts)
 * marks it PAID and it appears in Orders and the packing queue exactly like
 * any other sale — nothing downstream needed to change for this feature.
 */

export type ManualOrderItemInput = {
  printId: string;
  /** Required when the print is a limited edition — the admin's exact pick. */
  requestedEditionNumber?: number | null;
  /** Only meaningful for an open edition (no numbers) — e.g. selling 3 mugs
   * in one go. Ignored (always 1) for a limited edition. */
  quantity?: number;
};

export type CreateManualOrderResult =
  | { ok: true; orderId: string; paymentLinkUrl: string | null; emailSent: boolean; emailError?: string; linkError?: string }
  | { ok: false; error: string };

function renderPaymentLinkEmail(params: {
  orderNumber: string;
  paymentLinkUrl: string;
  items: { title: string; editionNumber: number | null; priceMinor: number; currency: string }[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
}) {
  const rows = params.items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;">
            ${i.title}${i.editionNumber ? ` — edition #${i.editionNumber}` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;text-align:right;white-space:nowrap;">
            ${formatMinor(i.priceMinor, i.currency)}
          </td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;max-width:520px;margin:0 auto;">
      <p>Hello,</p>
      <p>Thank you for your order with Slowly Downward. Please use the link below to complete payment and provide your shipping details.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;">
        ${rows}
        <tr>
          <td style="padding:8px 0;">Subtotal</td>
          <td style="padding:8px 0;text-align:right;">${formatMinor(params.subtotalMinor, params.currency)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;">Shipping</td>
          <td style="padding:8px 0;text-align:right;">${formatMinor(params.shippingMinor, params.currency)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:bold;">Total</td>
          <td style="padding:8px 0;text-align:right;font-weight:bold;">${formatMinor(params.totalMinor, params.currency)}</td>
        </tr>
      </table>
      <p style="text-align:center;margin:32px 0;">
        <a href="${params.paymentLinkUrl}" style="background:#1a1a1a;color:#fdfaf4;padding:14px 28px;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">
          Complete your order
        </a>
      </p>
      <p style="font-size:12px;color:#6b6558;">Order ${params.orderNumber}. This link is reserved for you — the item(s) above are being held pending your payment.</p>
    </div>
  `;
}

/** Creates or refreshes the Stripe Checkout Session (and payment link) for
 * an existing manual order — used both right after creating one, and by
 * the order page's "Generate new payment link" action for when the
 * original link has gone stale (Stripe Checkout links stop working after
 * about 24 hours, well within how long an archive-print sale might
 * reasonably take to close). */
export async function createOrRefreshPaymentLink(orderId: string): Promise<string> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { print: true } }, customer: true },
  });
  if (order.status !== "PENDING_PAYMENT") {
    throw new Error("This order is no longer awaiting payment.");
  }

  const line_items = order.items.map((item) => ({
    quantity: 1,
    price_data: {
      currency: item.print.currency.toLowerCase(),
      unit_amount: item.unitPriceMinor,
      product_data: {
        name: item.print.title,
        description: item.requestedEditionNumber ? `Edition #${item.requestedEditionNumber}` : undefined,
        images: item.print.primaryImageUrl ? [item.print.primaryImageUrl] : undefined,
      },
    },
  }));

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.customer.email,
    line_items,
    // Re-applied every time a link is (re)created — unlike the storefront
    // checkout, a manual order's link can be regenerated well after the
    // order itself was created, so this can't just be set once.
    shipping_address_collection: order.shippingCountry ? { allowed_countries: [order.shippingCountry] } : undefined,
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: order.shippingMinor, currency: "gbp" },
          display_name: "Shipping",
        },
      },
    ],
    metadata: { orderId: order.id },
    success_url: `${process.env.STORE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.STORE_URL}/checkout/cancel`,
    managed_payments: { enabled: false },
  } as any);

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: stripeSession.id, paymentLinkUrl: stripeSession.url },
  });

  return stripeSession.url!;
}

/** (Re)sends the payment-link email for an existing manual order — used
 * both right after creating one, and by the order page's "Resend email"
 * action. Requires a payment link to already exist (create/refresh it
 * first). */
export async function sendPaymentLinkEmailForOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { print: true } }, customer: true },
  });
  if (!order.paymentLinkUrl) {
    throw new Error("No payment link yet — generate one first.");
  }

  const html = renderPaymentLinkEmail({
    orderNumber: order.orderNumber,
    paymentLinkUrl: order.paymentLinkUrl,
    items: order.items.map((i) => ({
      title: i.print.title,
      editionNumber: i.requestedEditionNumber,
      priceMinor: i.unitPriceMinor,
      currency: order.currency,
    })),
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
  });

  await sendEmail({
    to: order.customer.email,
    subject: `Complete your order — ${order.orderNumber} — Slowly Downward`,
    html,
  });

  await prisma.order.update({ where: { id: order.id }, data: { paymentLinkSentAt: new Date() } });
}

export async function createManualOrder(params: {
  customerEmail: string;
  country: string;
  items: ManualOrderItemInput[];
  note?: string;
  createdByUserId: string;
}): Promise<CreateManualOrderResult> {
  const { customerEmail, country, items, note, createdByUserId } = params;
  if (items.length === 0) return { ok: false, error: "Add at least one item." };
  if (!customerEmail.trim()) return { ok: false, error: "Enter the client's email address." };

  const zones = await getShippingZones();
  const zone = zoneForCountry(zones, country);
  if (!zone) {
    return { ok: false, error: `You don't currently have a shipping zone covering ${countryName(country)}.` };
  }

  const prints = await prisma.print.findMany({ where: { id: { in: items.map((i) => i.printId) } } });
  const printMap = new Map(prints.map((p) => [p.id, p]));

  // A hold that's simply timed out (from ordinary storefront browsing)
  // shouldn't block an admin from claiming that number here.
  for (const printId of new Set(items.map((i) => i.printId))) {
    await releaseExpiredReservations(prisma, printId);
  }

  const manualToken = `manual-${crypto.randomUUID()}`;

  let orderId: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const orderItemsData: {
        printId: string;
        unitPriceMinor: number;
        requestedEditionNumber: number | null;
        reservationToken: string | null;
      }[] = [];

      for (const item of items) {
        const print = printMap.get(item.printId);
        if (!print) throw new Error("One of the selected prints no longer exists.");

        if (print.editionSize !== null) {
          // Limited edition — the whole point of this feature is the admin
          // choosing the exact physical copy, so a number is required.
          if (!item.requestedEditionNumber) {
            throw new Error(`Pick an edition number for "${print.title}".`);
          }
          const claim = await tx.edition.updateMany({
            where: { printId: print.id, number: item.requestedEditionNumber, status: "AVAILABLE" },
            data: {
              status: "RESERVED",
              reservedAt: new Date(),
              // No expiry — unlike a storefront browsing hold, this is only
              // ever released by the client paying or the admin cancelling.
              reservedUntil: null,
              reservationToken: manualToken,
            },
          });
          if (claim.count === 0) {
            throw new Error(`#${item.requestedEditionNumber} of "${print.title}" isn't available any more.`);
          }
          orderItemsData.push({
            printId: print.id,
            unitPriceMinor: print.priceMinor,
            requestedEditionNumber: item.requestedEditionNumber,
            reservationToken: manualToken,
          });
        } else {
          // Open edition — no numbers to hold, just however many copies were asked for.
          const quantity = Math.max(1, Math.min(20, item.quantity ?? 1));
          for (let i = 0; i < quantity; i++) {
            orderItemsData.push({
              printId: print.id,
              unitPriceMinor: print.priceMinor,
              requestedEditionNumber: null,
              reservationToken: null,
            });
          }
        }
      }

      const subtotalMinor = orderItemsData.reduce((sum, i) => sum + i.unitPriceMinor, 0);
      const customer = await tx.customer.upsert({
        where: { email: customerEmail.toLowerCase().trim() },
        update: {},
        create: { email: customerEmail.toLowerCase().trim() },
      });

      return tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: customer.id,
          status: "PENDING_PAYMENT",
          source: "MANUAL",
          createdByUserId,
          customerNote: note || null,
          subtotalMinor,
          shippingMinor: zone.priceMinor,
          shippingCountry: country.toUpperCase(),
          totalMinor: subtotalMinor + zone.priceMinor,
          items: { create: orderItemsData },
        },
      });
    });
    orderId = order.id;
  } catch (err: any) {
    // Nothing was committed (the whole thing is one transaction) — safe to
    // just report the problem, no cleanup needed.
    return { ok: false, error: err?.message || "Couldn't create the order." };
  }

  // The order and its held editions now exist for good — a failure past
  // this point (Stripe being unreachable, email not configured) is
  // recoverable from the order's own page ("Generate new payment link" /
  // "Resend email"), not a reason to treat the whole thing as failed.
  let paymentLinkUrl: string | null = null;
  let linkError: string | undefined;
  try {
    paymentLinkUrl = await createOrRefreshPaymentLink(orderId);
  } catch (err: any) {
    linkError = err?.message || "Couldn't create a payment link.";
  }

  let emailSent = false;
  let emailError: string | undefined;
  if (paymentLinkUrl) {
    try {
      await sendPaymentLinkEmailForOrder(orderId);
      emailSent = true;
    } catch (err: any) {
      emailError = err?.message || "Couldn't send the email.";
    }
  }

  return { ok: true, orderId, paymentLinkUrl, emailSent, emailError, linkError };
}

/** Cancels a manual order that's still awaiting payment — releases every
 * edition it was holding back to AVAILABLE and invalidates the payment
 * link, so the client can no longer pay for it. Refuses anything already
 * paid (use a refund for that instead, same as any other order). */
export async function cancelManualOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.status !== "PENDING_PAYMENT") {
    throw new Error("Only an order still awaiting payment can be cancelled this way.");
  }

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.requestedEditionNumber) continue;
      await tx.edition.updateMany({
        where: {
          printId: item.printId,
          number: item.requestedEditionNumber,
          status: "RESERVED",
          reservationToken: item.reservationToken ?? undefined,
        },
        data: { status: "AVAILABLE", reservedAt: null, reservedUntil: null, reservationToken: null },
      });
    }
    await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  });

  // Best-effort — stops the client paying into a cancelled order if they
  // still have the email open, but the order's own status is what actually
  // governs fulfilment, so a failure here (already expired, etc.) is fine.
  if (order.stripeSessionId) {
    try {
      await stripe.checkout.sessions.expire(order.stripeSessionId);
    } catch {
      // ignore — already expired/completed, or Stripe unreachable
    }
  }
}
