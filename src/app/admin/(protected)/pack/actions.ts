"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUpsShipment, upsConfigured } from "@/lib/integrations/ups";
import { createRoyalMailShipment, royalMailConfigured } from "@/lib/integrations/royalmail";

export async function markOrderPacked(orderId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKER"].includes(session.user.role)) {
    throw new Error("Not authorised");
  }

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const address = order.shippingAddress as any;
  const country = address?.country ?? "GB";

  let trackingNumber: string | undefined;
  let labelUrl: string | undefined;
  let carrier: "UPS" | "ROYAL_MAIL" | "UNASSIGNED" = "UNASSIGNED";

  const shipTo = {
    name: order.shippingName ?? "Customer",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? undefined,
    city: address?.city ?? "",
    postalCode: address?.postal_code ?? "",
    countryCode: country,
  };

  try {
    if (country === "GB" && royalMailConfigured()) {
      const label = await createRoyalMailShipment({ shipTo, reference: order.orderNumber });
      trackingNumber = label.trackingNumber;
      labelUrl = label.labelUrl;
      carrier = "ROYAL_MAIL";
    } else if (country !== "GB" && upsConfigured()) {
      const label = await createUpsShipment({ shipTo, reference: order.orderNumber });
      trackingNumber = label.trackingNumber;
      labelUrl = label.labelUrl;
      carrier = "UPS";
    }
  } catch (err) {
    // Label creation failing shouldn't block packing — staff can generate
    // the label manually from the carrier's own portal and add the tracking
    // number later. Log it so it isn't silently lost.
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "shipping_label_failed",
        entityType: "Order",
        entityId: orderId,
        meta: { error: err instanceof Error ? err.message : String(err) },
      },
    });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PACKED",
      packedByUserId: session.user.id,
      packedAt: new Date(),
      trackingNumber,
      labelUrl,
      shippingCarrier: carrier,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "order_packed", entityType: "Order", entityId: orderId },
  });

  revalidatePath("/admin/pack");
  revalidatePath(`/admin/orders/${orderId}`);
}
