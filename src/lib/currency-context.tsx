"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ExchangeRates } from "@/lib/currency";

const STORAGE_KEY = "slowlydownward_currency";

type CurrencyContextType = {
  /** The currency actually in effect right now — the visitor's manual
   * choice if they made one, otherwise the IP-detected default. */
  currency: string;
  /** True when showing the IP-detected currency rather than a manual pick. */
  isAuto: boolean;
  rates: ExchangeRates;
  /** Pass a currency code to override, or "AUTO" to go back to detection. */
  setCurrency: (code: string) => void;
};

const CurrencyContext = createContext<CurrencyContextType | null>(null);

/** Provides the visitor's display currency (for showing converted prices —
 * checkout always still happens in the store's own currency) plus the
 * exchange rates needed to convert. The detected currency and rates come
 * from the server (root layout); any manual override the visitor picks is
 * remembered in this browser via localStorage. */
export function CurrencyProvider({
  detectedCurrency,
  rates,
  children,
}: {
  detectedCurrency: string;
  rates: ExchangeRates;
  children: React.ReactNode;
}) {
  const [override, setOverride] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOverride(saved);
    } catch {
      // Storage unavailable — just stick with the detected currency.
    }
  }, []);

  function setCurrency(code: string) {
    if (code === "AUTO") {
      setOverride(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    setOverride(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore — the choice just won't be remembered next visit
    }
  }

  return (
    <CurrencyContext.Provider
      value={{
        currency: override ?? detectedCurrency,
        isAuto: override === null,
        rates,
        setCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
