import type { Order, OrderItem, Print } from "@prisma/client";

/**
 * Turns one order's items into the customs line items needed for an
 * international shipment — used both for the commercial invoice PDF
 * (src/lib/commercial-invoice.ts) and for the customs section of the UPS
 * shipment request (src/lib/integrations/ups.ts), so the two always agree.
 *
 * Every field on a Print is optional until someone fills it in on the
 * product page (Admin > Products > a print > "Shipping & customs"), so this
 * falls back to conservative generic defaults rather than failing — orders
 * for unfinished products can still be packed, just with placeholder
 * customs paperwork until the real details are added.
 */

export type CustomsLine = {
  description: string;
  hsCode: string;
  quantity: number;
  unitValueMinor: number;
  totalValueMinor: number;
  weightGrams: number;
  originCountryCode: string;
};

export type CustomsSummary = {
  lines: CustomsLine[];
  totalValueMinor: number;
  totalWeightGrams: number;
  /** True if every line item has real (not fallback) weight, value, and
   * description/HS code — used to warn staff when paperwork is generic. */
  allDetailsComplete: boolean;
};

// Fallback weight, same figure already used as Royal Mail's placeholder
// elsewhere in this codebase, kept consistent for anything unweighed.
const DEFAULT_UNIT_WEIGHT_GRAMS = 500;

// "Original engravings, prints and lithographs" — the Harmonized System
// heading generally used for limited-edition art prints. This is a
// reasonable generic default, NOT a substitute for checking the correct
// commodity code for a specific print with HMRC's Trade Tariff tool or your
// customs broker — screenprints, giclée, and other techniques can sit under
// different sub-headings, and getting this wrong can hold a parcel at
// customs. Set a specific code per print on its product page to override.
const DEFAULT_HS_CODE = "9702.00";

type OrderWithItems = Order & { items: (OrderItem & { print: Print })[] };

export function getCustomsSummary(order: OrderWithItems, originCountryCode: string): CustomsSummary {
  const lines: CustomsLine[] = order.items.map((item) => {
    const print = item.print;
    const weightGrams = print.weightGrams ?? DEFAULT_UNIT_WEIGHT_GRAMS;
    const unitValueMinor = print.customsValueMinor ?? item.unitPriceMinor;
    return {
      description: print.customsDescription?.trim() || print.title,
      hsCode: print.customsCode?.trim() || DEFAULT_HS_CODE,
      quantity: 1,
      unitValueMinor,
      totalValueMinor: unitValueMinor,
      weightGrams,
      originCountryCode,
    };
  });

  const allDetailsComplete = order.items.every(
    (item) => item.print.weightGrams != null && item.print.customsValueMinor != null && item.print.customsCode
  );

  return {
    lines,
    totalValueMinor: lines.reduce((sum, l) => sum + l.totalValueMinor, 0),
    totalWeightGrams: lines.reduce((sum, l) => sum + l.weightGrams, 0),
    allDetailsComplete,
  };
}

/** Overall packaged dimensions for an order's parcel — used for the UPS
 * rate quote and shipment. Since prints of different sizes packed together
 * can't be reduced to one box automatically, this just takes the largest
 * single item's dimensions as a stand-in (a reasonable estimate for the
 * common case of one print per order) rather than guessing how they'd be
 * combined. Falls back to a generic flat-parcel size if nothing is set. */
export function getPackageDimensionsCm(order: OrderWithItems): { lengthCm: number; widthCm: number; heightCm: number } {
  const withDims = order.items
    .map((i) => i.print)
    .filter((p) => p.lengthCm != null && p.widthCm != null && p.heightCm != null);

  if (withDims.length === 0) {
    return { lengthCm: 60, widthCm: 40, heightCm: 5 }; // generic flat/rolled print parcel
  }

  const largest = withDims.reduce((max, p) =>
    (p.lengthCm! * p.widthCm! * p.heightCm!) > (max.lengthCm! * max.widthCm! * max.heightCm!) ? p : max
  );
  return { lengthCm: largest.lengthCm!, widthCm: largest.widthCm!, heightCm: largest.heightCm! };
}
