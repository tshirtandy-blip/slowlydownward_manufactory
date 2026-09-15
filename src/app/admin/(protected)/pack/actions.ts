"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUpsShipment, upsConfigured, getUpsRate, uploadPaperlessInvoice } from "@/lib/integrations/ups";
import { createRoyalMailShipment, royalMailConfigured } from "@/lib/integrations/royalmail";
import { getStoreAddress, storeAddressConfigured } from "@/lib/store-address";
import { getCustomsSummary, getPackageDimensionsCm, withCustomsValueOverride } from "@/lib/customs";
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
 * actual weight, not the flat price the customer paid at checkout.
 *
 * Also returns the defaults for the "confirm parcel size and customs
 * value" step shown before a UPS label is created for anything leaving the
 * UK — destinationCountry/requiresCustoms decide whether that step is shown
 * at all, and defaultDims/defaultCustomsValueMinor pre-fill it from the
 * order's own items (largest item's dimensions, summed customs value —
 * see src/lib/customs.ts) so a packer only needs to change something if
 * it's actually wrong. */
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
  const destinationCountry = String(address?.country || "GB").toUpperCase();
  const requiresCustoms = needsCustoms(destinationCountry);

  let royalMail: { amountMinor: number; currency: string; service: string; overWeight: boolean } | null = null;
  let royalMailError: string | null = "No shipping address captured for this order yet.";
  if (address) {
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
      destinationCountry,
      requiresCustoms,
      defaultDims: dims,
      defaultCustomsValueMinor: customs.totalValueMinor,
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
      customsPlaceholder: requiresCustoms && !customs.allDetailsComplete,
      destinationCountry,
      requiresCustoms,
      defaultDims: dims,
      defaultCustomsValueMinor: customs.totalValueMinor,
    };
  } catch (err) {
    return {
      royalMail,
      royalMailError,
      ups: null,
      upsError: err instanceof Error ? err.message : "UPS rate lookup failed.",
      customsPlaceholder: false,
      destinationCountry,
      requiresCustoms,
      defaultDims: dims,
      defaultCustomsValueMinor: customs.totalValueMinor,
    };
  }
}

/** Packer-confirmed overrides from the "confirm parcel size and customs
 * value" step — only ever supplied for a UPS shipment leaving the UK.
 * customsValueMinor is optional since a packer might only need to correct
 * the dimensions. */
export type PackOverrides = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  customsValueMinor?: number;
};

export async function packOrder(
  orderId: string,
  carrier: PackCarrier,
  overrides?: PackOverrides
): Promise<
  | { ok: true; labelWarning?: string; labelUrl?: string; trackingNumber?: string }
  | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKER"].includes(session.user.role)) {
    return { ok: false, error: "Not authorised" };
  }

  // Wrapped so ANY unexpected failure here — a bad database lookup, a
  // carrier API throwing something not already caught below, etc — comes
  // back as a plain, readable error the packing screen can show and keep
  // on screen, instead of an uncaught exception that shows Next.js's own
  // generic error toast (easy to miss — it's what looked like a red
  // message flashing and vanishing).
  try {
    return await packOrderUnsafe(orderId, carrier, session.user.id, overrides);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Packing failed unexpectedly." };
  }
}

async function packOrderUnsafe(
  orderId: string,
  carrier: PackCarrier,
  userId: string,
  overrides?: PackOverrides
): Promise<{ ok: true; labelWarning?: string; labelUrl?: string; trackingNumber?: string }> {
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
        // A packer can confirm/correct the parcel size and declared customs
        // value on the packing screen before a label is created (only shown
        // for shipments leaving the UK) — use those figures when given,
        // otherwise fall back to what's calculated from the order's items.
        const dims = overrides
          ? { lengthCm: overrides.lengthCm, widthCm: overrides.widthCm, heightCm: overrides.heightCm }
          : getPackageDimensionsCm(order);
        const rawCustoms = getCustomsSummary(order, shipFrom.countryCode);
        const customs = withCustomsValueOverride(rawCustoms, overrides?.customsValueMinor);
        const pkg = { weightGrams: rawCustoms.totalWeightGrams, ...dims };

        // International shipments need customs paperwork attached
        // electronically ("paperless") — generate the commercial invoice and
        // upload it to UPS first, so the shipment request below can
        // reference it. If the upload fails, the shipment still goes ahead
        // with the customs data inline and a warning, rather than blocking
        // packing entirely.
        let invoiceDocumentId: string | undefined;
        if (needsCustoms(shipTo.countryCode)) {
          try {
            const pdf = await buildCommercialInvoicePdf({ order, shipFrom, shipTo, customs });
            invoiceDocumentId = await uploadPaperlessInvoice({
              pdfBase64: pdf.toString("base64"),
              reference: order.orderNumber,
            });
          } catch (invoiceErr) {
            labelWarning = `Commercial invoice couldn't be uploaded to UPS automatically (${invoiceErr instanceof Error ? invoiceErr.message : "unknown error"}) — the shipment was created with customs details attached directly instead. You can still download/print the invoice from this order as a backup.`;
          }
        }

        // UPS requires exactly one named service on the actual shipment
        // (error 9120115, "Missing service information") — resolved fresh
        // here via the same rate-lookup used for the packing screen's
        // quote, rather than a hardcoded guess, so it's guaranteed to be a
        // service this account can actually use for this route. Falls back
        // to a sensible default only if that lookup itself fails, so a
        // rating hiccup doesn't block packing entirely.
        let serviceCode: string;
        try {
          const rate = await getUpsRate({ shipFrom, shipTo, package: pkg });
          serviceCode = rate.serviceCode;
        } catch {
          // "11" (UPS Standard) covers the UK and intra-Europe; "65" (UPS
          // Worldwide Saver) is a widely available service for everywhere
          // else — reasonable fallbacks if the live lookup is unavailable.
          const europeanish = ["GB", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "PT", "AT", "DK", "SE", "FI", "PL"];
          serviceCode = europeanish.includes(shipTo.countryCode.toUpperCase()) ? "11" : "65";
        }

        const label = await createUpsShipment({
          shipFrom,
          shipTo,
          reference: order.orderNumber,
          package: pkg,
          serviceCode,
          customs: needsCustoms(shipTo.countryCode) ? { items: customs.lines, invoiceDocumentId } : undefined,
        });
        trackingNumber = label.trackingNumber;
        // UPS labels are requested as GIF (see src/lib/integrations/ups.ts)
        // so they print through any printer's normal driver — Royal Mail's
        // labelBase64 case never happens in practice (it returns a hosted
        // labelUrl instead) but is kept as a PDF fallback just in case.
        labelUrl =
          label.labelUrl ??
          (label.labelBase64
            ? `data:${label.labelFormat === "GIF" ? "image/gif" : "application/pdf"};base64,${label.labelBase64}`
            : undefined);
      }
    } catch (err) {
      // Label creation failing shouldn't block packing — staff can generate
      // the label manually from the carrier's own portal and add the
      // tracking number later.
      labelWarning = err instanceof Error ? err.message : "Label creation failed.";
      await prisma.auditLog.create({
        data: {
          userId,
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
      packedByUserId: userId,
      packedAt: new Date(),
      trackingNumber,
      labelUrl,
      shippingCarrier: carrier,
      courierStatus: carrier === "COLLECTION" ? "Awaiting collection" : trackingNumber ? "Label created" : undefined,
      courierStatusAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: { userId, action: "order_packed", entityType: "Order", entityId: orderId, meta: { carrier } },
  });

  // Deliberately NOT revalidating /admin/pack here. That list only shows
  // orders still awaiting packing, so the moment this one flips to PACKED
  // it would drop out of the list — refreshing this page immediately would
  // yank the just-packed order (and the label/print button, or an error
  // message) off the screen before a packer could read or use it. The
  // order/orders pages are still revalidated so they're accurate whenever
  // someone next opens them; the packing queue simply catches up with this
  // order's absence next time it's loaded or refreshed.
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");

  return { ok: true, labelWarning, labelUrl, trackingNumber };
}
