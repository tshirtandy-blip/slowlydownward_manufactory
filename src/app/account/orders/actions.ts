"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/integrations/resend";
import { renderWithdrawalConfirmationEmail } from "@/lib/email-templates";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getCustomerId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const customer = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
  return customer ? (customer as any).id : null;
}

// A contract that either hasn't concluded yet (still awaiting payment) or
// has already unwound (cancelled/refunded) has nothing left to withdraw
// from.
const NOT_WITHDRAWABLE_STATUSES = new Set(["PENDING_PAYMENT", "CANCELLED", "REFUNDED"]);

/** The EU/UK "right to cancel" — a customer withdrawing from the contract
 * for one of their own orders, no reason required. This only records the
 * request (an audit-log entry + Order.withdrawnAt) and emails them the
 * legally-required dated receipt — it deliberately does NOT touch stock,
 * order status, or trigger a refund automatically. Staff see the request
 * flagged on the order in Admin > Orders and process the actual return/
 * refund themselves, the same "human does the money part" pattern as
 * every other refund in this app. */
export async function requestOrderWithdrawal(orderId: string, note?: string): Promise<ActionResult> {
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, error: "You need to be signed in." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { print: true, edition: true } }, customer: true },
  });
  if (!order || order.customerId !== customerId) {
    return { ok: false, error: "Order not found." };
  }
  if (NOT_WITHDRAWABLE_STATUSES.has(order.status)) {
    return { ok: false, error: "This order isn't eligible to be withdrawn from." };
  }
  if (order.withdrawnAt) {
    return { ok: false, error: "You've already asked to withdraw from this order — we'll be in touch." };
  }

  const requestedAt = new Date();
  const trimmedNote = note?.trim() || null;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { withdrawnAt: requestedAt, withdrawalReason: trimmedNote },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "Order",
        entityId: order.id,
        action: "withdrawal_requested",
        meta: { requestedAt: requestedAt.toISOString(), note: trimmedNote },
      },
    }),
  ]);

  // Best-effort — the withdrawal is already recorded either way; a failed
  // email here shouldn't make the request itself look like it failed.
  try {
    const { subject, html } = await renderWithdrawalConfirmationEmail({
      orderNumber: order.orderNumber,
      requestedAt,
      items: order.items.map((i) => ({
        title: i.print.title,
        editionNumber: i.edition?.number ?? i.requestedEditionNumber ?? null,
        priceMinor: i.unitPriceMinor,
        currency: order.currency,
      })),
      totalMinor: order.totalMinor,
      currency: order.currency,
    });
    await sendEmail({ to: order.customer.email, subject, html });
  } catch (err) {
    console.error("requestOrderWithdrawal: confirmation email failed:", err);
  }

  revalidatePath("/account/orders");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");

  return { ok: true };
}
