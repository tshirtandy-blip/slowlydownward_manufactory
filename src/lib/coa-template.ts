import { prisma } from "@/lib/prisma";
import type { Order, OrderItem, Print, Edition } from "@prisma/client";
import { DEFAULT_COA_BODY_HTML, DEFAULT_COA_CSS, substituteTokens } from "@/lib/coa-merge-fields";

export { COA_MERGE_FIELDS, DEFAULT_COA_BODY_HTML, DEFAULT_COA_CSS } from "@/lib/coa-merge-fields";

/**
 * Certificate of Authenticity templates — see Admin > Settings > COA
 * template (the global default) and a product's own "Certificate of
 * Authenticity" section (a per-product override). Server-only (imports
 * Prisma) — the client-side template editor's live preview uses
 * src/lib/coa-merge-fields.ts directly instead.
 */

export type ResolvedCoaTemplate = {
  id: string;
  printId: string | null;
  name: string;
  pageSize: string;
  bodyHtml: string;
  css: string;
};

/** The single global default template row (printId null) — created the
 * first time it's needed, same lazy-singleton idea as getSiteSettings() in
 * src/lib/site-settings.ts. Always returns something usable, even if the
 * database is briefly unreachable or two requests race to create it. */
export async function getGlobalCoaTemplate(): Promise<ResolvedCoaTemplate> {
  const fallback: ResolvedCoaTemplate = {
    id: "default",
    printId: null,
    name: "Certificate of Authenticity",
    pageSize: "A5",
    bodyHtml: DEFAULT_COA_BODY_HTML,
    css: DEFAULT_COA_CSS,
  };

  try {
    const existing = await prisma.coaTemplate.findFirst({ where: { printId: null } });
    if (existing) return existing;

    try {
      return await prisma.coaTemplate.create({
        data: {
          printId: null,
          name: fallback.name,
          pageSize: fallback.pageSize,
          bodyHtml: fallback.bodyHtml,
          css: fallback.css,
        },
      });
    } catch {
      // Another request created it in the meantime — re-read rather than
      // erroring the packer's flow over a benign race.
      const retried = await prisma.coaTemplate.findFirst({ where: { printId: null } });
      return retried ?? fallback;
    }
  } catch {
    return fallback;
  }
}

/** A product's own override, if it has one — null means it's using the
 * global default. Used by the per-product COA editor to show which state
 * it's in. */
export async function getCoaTemplateOverride(printId: string) {
  return prisma.coaTemplate.findUnique({ where: { printId } });
}

/** The template that should actually be used for one print: its own
 * override if it has one, otherwise the global default. */
export async function resolveCoaTemplate(printId: string): Promise<ResolvedCoaTemplate> {
  const override = await prisma.coaTemplate.findUnique({ where: { printId } });
  if (override) return override;
  return getGlobalCoaTemplate();
}

/** Builds the {{token}} -> value map for one real order item and runs it
 * through the shared substituteTokens() (src/lib/coa-merge-fields.ts).
 * primaryImageUrl is not HTML-escaped since it's meant to be used as an
 * <img src="..."> attribute value, not text content. */
export function substituteMergeFields(
  html: string,
  item: OrderItem & { print: Print; edition: Edition | null },
  order: Order
): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return substituteTokens(html, {
    printTitle: escape(item.print.title),
    artist: escape(item.print.artist),
    editionNumber: item.edition ? String(item.edition.number) : "—",
    editionSize: item.print.editionSize ? String(item.print.editionSize) : "Open edition",
    paperSize: escape(item.print.paperSize ?? ""),
    printSize: escape(item.print.imageSize ?? ""),
    orderNumber: escape(order.orderNumber),
    customerName: escape(order.shippingName ?? ""),
    date: new Date(order.createdAt).toLocaleDateString("en-GB"),
    primaryImageUrl: item.print.primaryImageUrl ?? "",
  });
}

/** A fabricated order item + order, used only to drive the Settings
 * editor's "Preview PDF" button (a real puppeteer-rendered PDF of sample
 * data) — never written to the database. Lets an owner see realistic
 * output before any real order exists. */
export function sampleCoaData(
  print: Pick<Print, "id" | "title" | "artist" | "editionSize" | "paperSize" | "imageSize" | "primaryImageUrl">
): { item: OrderItem & { print: Print; edition: Edition | null }; order: Order } {
  const now = new Date();
  const item = {
    id: "sample-item",
    orderId: "sample-order",
    printId: print.id,
    editionId: "sample-edition",
    requestedEditionNumber: null,
    reservationToken: null,
    unitPriceMinor: 0,
    editionConfirmedByPacker: false,
    editionConfirmedAt: null,
    editionConfirmedByUserId: null,
    coaPrintedAt: null,
    coaPrintedByUserId: null,
    packed: false,
    packedAt: null,
    createdAt: now,
    print: print as Print,
    edition: {
      id: "sample-edition",
      printId: print.id,
      number: 47,
      status: "SOLD",
      locationId: null,
      notes: null,
      soldAt: now,
      reservedAt: null,
      reservedUntil: null,
      reservationToken: null,
      createdAt: now,
      updatedAt: now,
    } as Edition,
  } as OrderItem & { print: Print; edition: Edition | null };

  const order = {
    id: "sample-order",
    orderNumber: "SD26-1234",
    customerId: "sample-customer",
    status: "PAID",
    source: "STOREFRONT",
    createdByUserId: null,
    stripeSessionId: null,
    stripePaymentIntentId: null,
    paymentLinkUrl: null,
    paymentLinkSentAt: null,
    subtotalMinor: 0,
    shippingMinor: 0,
    totalMinor: 0,
    currency: "GBP",
    shippingName: "A. Sample Customer",
    shippingAddress: null,
    billingAddress: null,
    shippingCountry: "GB",
    shippingCarrier: "UNASSIGNED",
    trackingNumber: null,
    labelUrl: null,
    shippedAt: null,
    courierStatus: null,
    courierStatusAt: null,
    packedByUserId: null,
    packedAt: null,
    xeroInvoiceId: null,
    mailchimpSynced: false,
    customerNote: null,
    withdrawnAt: null,
    withdrawalReason: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as Order;

  return { item, order };
}
