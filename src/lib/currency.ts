// The store's own prices are always stored and charged in this currency —
// everything here is about DISPLAY only. Nothing in checkout changes.
export const BASE_CURRENCY = "GBP";

/** Currencies offered in the header's currency picker. Add more here any
 * time — this is the only place that needs to change. */
export const SUPPORTED_CURRENCIES = [
  { code: "GBP", label: "United Kingdom — GBP £" },
  { code: "USD", label: "United States — USD $" },
  { code: "EUR", label: "Eurozone — EUR €" },
  { code: "CAD", label: "Canada — CAD $" },
  { code: "AUD", label: "Australia — AUD $" },
  { code: "JPY", label: "Japan — JPY ¥" },
  { code: "CHF", label: "Switzerland — CHF" },
  { code: "SEK", label: "Sweden — SEK" },
  { code: "NOK", label: "Norway — NOK" },
  { code: "DKK", label: "Denmark — DKK" },
  { code: "NZD", label: "New Zealand — NZD $" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export type ExchangeRates = Record<string, number>;

// A rough, occasionally-stale fallback so the currency picker still works
// (just less precisely) if the live rates API is unreachable — e.g. no
// internet in local dev, or the free API having a bad day. Never used for
// anything that touches real money.
const FALLBACK_RATES: ExchangeRates = {
  GBP: 1, USD: 1.27, EUR: 1.17, CAD: 1.74, AUD: 1.92,
  JPY: 189, CHF: 1.13, SEK: 13.4, NOK: 13.6, DKK: 8.7, NZD: 2.09,
};

/** Fetches GBP-based exchange rates for the display-currency conversion,
 * cached for a few hours via Next's fetch cache. Falls back to a static
 * table (never to an error) so a flaky third-party API can't take the
 * storefront down. */
export async function getExchangeRates(): Promise<ExchangeRates> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/GBP", {
      next: { revalidate: 21600 }, // 6 hours
    });
    if (!res.ok) return FALLBACK_RATES;
    const data = await res.json();
    if (data?.result !== "success" || !data.rates) return FALLBACK_RATES;
    return data.rates as ExchangeRates;
  } catch {
    return FALLBACK_RATES;
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", CAD: "$", AUD: "$", JPY: "¥",
  CHF: "CHF ", SEK: "kr ", NOK: "kr ", DKK: "kr ", NZD: "$",
};

/** Converts a price stored in minor units of `fromCurrency` into a
 * formatted string in `toCurrency`, using the given GBP-based rate table.
 * Display purposes only — actual charges always happen in the print's own
 * stored currency. */
export function formatConverted(
  priceMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): string {
  if (toCurrency === fromCurrency) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: fromCurrency }).format(priceMinor / 100);
  }

  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;
  const amount = (priceMinor / 100 / fromRate) * toRate;

  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: toCurrency }).format(amount);
  } catch {
    // Unknown currency code to Intl — fall back to a plain symbol + number.
    const symbol = CURRENCY_SYMBOLS[toCurrency] ?? `${toCurrency} `;
    return `${symbol}${amount.toFixed(2)}`;
  }
}
