"use client";

import { useCurrency } from "@/lib/currency-context";
import { formatConverted } from "@/lib/currency";

/** Displays a price converted to the visitor's chosen/detected currency —
 * a client component so it can react instantly when they change the
 * currency picker, even though the print data around it is server-rendered.
 * Purely cosmetic: checkout always still charges in the print's own stored
 * currency. */
export function PriceTag({
  priceMinor,
  currency,
  className,
}: {
  priceMinor: number;
  currency: string;
  className?: string;
}) {
  const { currency: displayCurrency, rates } = useCurrency();
  return <span className={className}>{formatConverted(priceMinor, currency, displayCurrency, rates)}</span>;
}
