import { headers } from "next/headers";
import { BASE_CURRENCY, type CurrencyCode } from "./currency";

// This file is deliberately separate from currency.ts: it's the only place
// that needs next/headers (server-only), and currency.ts is imported by
// client components (SiteHeader, PriceTag, the cart page) that must never
// pull that in — Next.js errors on any client bundle that transitively
// touches next/headers, even via a shared import.

// Maps a 2-letter country code (as Vercel's IP geolocation header reports
// it: X-Vercel-IP-Country) to one of our supported display currencies.
// Anything not listed here falls back to BASE_CURRENCY.
const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  GB: "GBP",
  US: "USD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  // Eurozone
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
  DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR",
  LU: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR",
};

/** Reads the visitor's country from Vercel's IP-geolocation request header
 * and maps it to a display currency. Only populated when actually deployed
 * on Vercel — in local dev (and anywhere else) this quietly falls back to
 * the store's own currency, which is exactly the right default. Only call
 * this from a Server Component. */
export function detectCurrencyFromRequest(): CurrencyCode {
  try {
    const country = headers().get("x-vercel-ip-country");
    if (country && COUNTRY_TO_CURRENCY[country]) return COUNTRY_TO_CURRENCY[country];
  } catch {
    // headers() throws outside a request context — fine, just use the default.
  }
  return BASE_CURRENCY;
}
