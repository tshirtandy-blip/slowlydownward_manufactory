"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUpsShipment, upsConfigured, getUpsRate, uploadPaperlessInvoice } from "@/lib/integrations/ups";
import { createRoyalMailShipment, royalMailConfigured } from "@/lib/integrations/royalmail";
import { getStoreAddress, storeAddressConfigured } from "@/lib/store-address";
import { getCustomsSummary, getPackageDimensionsCm } from "@/lib/customs";
import { buildCommercialInvoicePdf } from "@/lib/commercial-invoice";
import { getRoyalMailRates, getRoyalMailCost } from "@/lib/royal-mail-rates";

/** An order needs customs paperwork once it's leaving the UK — the UK left
 * the EU customs union, so this is true for Europe as well as ROW, not just
 * ROW. UK domestic orders never need this. */
function needsCustoms(countryCode: string | undefined) {
  return !!countryCode && countryCode.toUpperCase() !== "GB";
}

export type PackCarrier = "ROYAL_MAIL" | "UPS" | "COLLECTION";

/** Packing-tab cost comparison for one order: a live UPS quote (needs UPS
 * credentials + a store address configured) and a calculated Royal Mail
 * cost from your own price list (needs at least one weight band set up —
 * see Admin > Settings > Shipping). Both are looked up from the order's
 * actual weight, not the flat price the customer paid at checkout. */
export async function getCarrierCosts(orderId: string) {
  // This file is "use server", which makes every export here a directly
  // invocable server action regardless of who imports it — so this checks
  // its own auth rather than relying on the page that happens to call it
  // today, same as packOrder below.
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKER"].includes(session.user.role)) {
    throw new Error("Not authorised");
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { print: true } } },
  });
  const address = order.shippingAddress as any;

  const dims = getPackageDimensionsCm(order);
  const customs = getCustomsSummary(order, getStoreAddress().countryCode);

  let royalMail: { amountMinor: number; currency: string; service: string; overWeight: boolean } | null = null;
  let royalMailError: string | null = "No shipping address captured for this order yet.";
  if (address) {
    const destinationCountry = String(address.country || "GB").toUpperCase();
    const royalMailRates = await getRoyalMailRates();
    const rmQuote = getRoyalMailCost({ countryCode: destinationCountry, weightGrams: customs.totalWeightGrams, ...dims }, royalMailRates);
    royalMail = rmQuote
      ? { amountMinor: rmQuote.amountMinor, currency: order.currency, service: rmQuote.service, overWeight: rmQuote.overWeight }
      : null;
    royalMailError = rmQuote ? null : `No Royal Mail price list row covers ${destinationCountry} yet (Admin > Settings > Shipping).`;
  }

  if (!upsConfigured() || !storeAddressConfigured() || !address) {
    return {
      royalMail,
      royalMailError,
      ups: null as null | { amountMinor: number; currency: string; service: string },
      upsError: !upsConfigured()
        ? "UPS isn't connected (Admin > Settings > Integrations)."
        : !storeAddressConfigured()
        ? "Your shipping address isn't set (STORE_ADDRESS_* in .env)."
        : "No shipping address captured for this order yet.",
      customsPlaceholder: false,
    };
  }

  try {
    const quote = await getUpsRate({
      shipFrom: getStoreAddress(),
      shipTo: {
        name: order.shippingName ?? "Customer",
        line1: address.line1 ?? "",
        line2: address.line2 ?? undefined,
        city: address.city ?? "",
        postalCode: address.postal_code ?? "",
        countryCode: address.country ?? "GB",
      },
      package: { weightGrams: customs.totalWeightGrams, ...dims },
    });
    return {
      royalMail,
      royalMailError,
      ups: quote,
      upsError: null as string | null,
      customsPlaceholder: needsCustoms(address.country) && !customs.allDetailsComplete,
    };
  } catch (err) {
    return {
      royalMail,
      royalMailError,
      ups: null,
      upsError: err instanceof Error ? err.message : "UPS rate lookup failed.",
      customsPlaceholder: false,
    };
  }
}

export async function packOrder(
  orderId: string,
  carrier: PackCarrier
): Promise<{ ok: true; labelWarning?: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKER"].includes(session.user.role)) {
    return { ok: false, error: "Not authorised" };
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { print: true } }, customer: true },
  });
  const address = order.shippingAddress as any;

  let trackingNumber: string | undefined;
  let labelUrl: string | undefined;
  let labelWarning: string | undefined;

  const shipTo = {
    name: order.shippingName ?? "Customer",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? undefined,
    city: address?.city ?? "",
    postalCode: address?.postal_code ?? "",
    countryCode: address?.country ?? "GB",
  };

  if (carrier === "ROYAL_MAIL" || carrier === "UPS") {
    try {
      const configured = carrier === "ROYAL_MAIL" ? royalMailConfigured() : upsConfigured();
      if (!configured) {
        labelWarning = `${carrier === "ROYAL_MAIL" ? "Royal Mail" : "UPS"} isn't connected yet — marked packed without a label. Add tracking manually once you've created one on the carrier's own site.`;
      } else if (carrier === "ROYAL_MAIL") {
        const label = await createRoyalMailShipment({ shipTo, reference: order.orderNumber });
        trackingNumber = label.trackingNumber;
        labelUrl = label.labelUrl ?? (label.labelBase64 ? `data:application/pdf;base64,${label.labelBase64}` : undefined);
      } else {
        const shipFrom = getStoreAddress();
        const dims = getPackageDimensionsCm(order);
        const customs = getCustomsSummary(order, shipFrom.countryCode);
        const pkg = { weightGrams: customs.totalWeightGrams, ...dims };

        // International shipments need customs paperwork attached
        // electronically ("paperless") — generate the commercial invoice and
        // upload it to UPS first, so the shipment request below can
        // reference it. If the upload fails, the shipment still goes ahead
        // with the customs data inline and a warning, rather than blocking
        // packing entirely.
        let invoiceDocumentId: string | undefined;
        if (needsCustoms(shipTo.countryCode)) {
          try {
            const pdf = await buildCommercialInvoicePdf({ order, shipFrom, shipTo });
            invoiceDocumentId = await uploadPaperlessInvoice({
              pdfBase64: pdf.toString("base64"),
              reference: order.orderNumber,
            });
          } catch (invoiceErr) {
            labelWarning = `Commercial invoice couldn't be uploaded to UPS automatically (${invoiceErr instanceof Error ? invoiceErr.message : "unknown error"}) — the shipment was created with customs details attached directly instead. You can still download/print the invoice from this order as a backup.`;
          }
        }

        const label = await createUpsShipment({
          shipTo,
          reference: order.orderNumber,
          package: pkg,
          customs: needsCustoms(shipTo.countryCode) ? { items: customs.lines, invoiceDocumentId } : undefined,
        });
        trackingNumber = label.trackingNumber;
        labelUrl = label.labelUrl ?? (label.labelBase64 ? `data:application/pdf;base64,${label.labelBase64}` : undefined);
      }
    } catch (err) {
      // Label creation failing shouldn't block packing — staff can generate
      // the label manually from the carrier's own portal and add the
      // tracking number later.
      labelWarning = err instanceof Error ? err.message : "Label creation failed.";
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "shipping_label_failed",
          entityType: "Order",
          entityId: orderId,
          meta: { error: labelWarning, carrier },
        },
      });
    }
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
      courierStatus: carrier === "COLLECTION" ? "Awaiting collection" : trackingNumber ? "Label created" : undefined,
      courierStatusAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "order_packed", entityType: "Order", entityId: orderId, meta: { carrier } },
  });

  revalidatePath("/admin/pack");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");

  return { ok: true, labelWarning };
}
