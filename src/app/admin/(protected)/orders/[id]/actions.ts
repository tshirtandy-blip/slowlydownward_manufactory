"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getUpsTracking } from "@/lib/integrations/ups";
import { getRoyalMailTracking } from "@/lib/integrations/royalmail";
import { cancelManualOrder, createOrRefreshPaymentLink, sendPaymentLinkEmailForOrder } from "@/lib/manual-orders";

async function requireOrdersAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccess(session.user.role as any, "orders")) throw new Error("Not authorised");
  return session;
}

/** Staff manually record what the carrier's own site currently shows —
 * fine to keep doing this indefinitely; "Refresh from carrier" below is
 * just a shortcut for whichever orders that already works for. */
export async function updateCourierStatus(orderId: string, formData: FormData) {
  await requireOrdersAccess();
  const status = String(formData.get("courierStatus") || "").trim();

  await prisma.order.update({
    where: { id: orderId },
    data: { courierStatus: status || null, courierStatusAt: status ? new Date() : null },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

/** Pulls the current status directly from UPS/Royal Mail's own tracking
 * API, when that order has a tracking number and the relevant carrier
 * account is configured. Throws a plain-English error otherwise, rather
 * than silently doing nothing — the button that calls this shows it. */
export async function refreshCourierStatus(orderId: string): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  await requireOrdersAccess();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  if (!order.trackingNumber) {
    return { ok: false, error: "No tracking number on this order yet." };
  }

  try {
    const event =
      order.shippingCarrier === "UPS"
        ? await getUpsTracking(order.trackingNumber)
        : order.shippingCarrier === "ROYAL_MAIL"
        ? await getRoyalMailTracking(order.trackingNumber)
        : null;

    if (!event) {
      return { ok: false, error: `No live tracking available for carrier "${order.shippingCarrier}".` };
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { courierStatus: event.status, courierStatusAt: new Date() },
    });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true, status: event.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Tracking lookup failed." };
  }
}

/** Creates a fresh Stripe payment link for a manual order (the first one,
 * or a replacement once the previous link has gone stale — Stripe Checkout
 * links stop working after about 24 hours). Doesn't touch the held
 * edition(s) at all, just the payment step. */
export async function regeneratePaymentLink(orderId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireOrdersAccess();
  try {
    const url = await createOrRefreshPaymentLink(orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't create a payment link." };
  }
}

/** (Re)sends the payment-link email to the client — e.g. after generating
 * a new link, or if they say they never got the first one. */
export async function resendPaymentLinkEmail(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOrdersAccess();
  try {
    await sendPaymentLinkEmailForOrder(orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't send the email." };
  }
}

// --- TEMPORARY: testing helper -------------------------------------------
// Lets Andrew re-test the packing/label flow against a real paid order
// without creating and paying for a fresh manual order each time. Resets
// everything the packing flow sets, back to how a freshly-paid order
// looks, so it reappears in the packing queue. ADMIN-only since it
// rewrites an order's real status. Remove this once the packing/label
// flow is confirmed working end-to-end and no longer needs repeat testing.
export async function resetOrderForTesting(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return { ok: false, error: "Not authorised" };
  }

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAID",
        shippingCarrier: "UNASSIGNED",
        trackingNumber: null,
        labelUrl: null,
        shippedAt: null,
        courierStatus: null,
        courierStatusAt: null,
        packedByUserId: null,
        packedAt: null,
      },
    });
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "order_reset_for_testing", entityType: "Order", entityId: orderId },
    });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/pack");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reset this order." };
  }
}
// ---------------------------------------------------------------------------

/** Cancels a manual order that's still awaiting payment — releases whatever
 * edition(s) it was holding and invalidates its payment link. Refuses
 * anything not a still-pending manual order (a paid order needs a refund
 * instead, same as any other order). */
export async function cancelOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOrdersAccess();
  try {
    await cancelManualOrder(orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't cancel this order." };
  }
}
