"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getReservationToken } from "@/lib/reservation-token";

export type CartItem = {
  printId: string;
  slug: string;
  title: string;
  priceMinor: number;
  currency: string;
  imageUrl?: string;
  quantity: number;
  requestedEditionNumber?: number | null;
  // When a specific number was requested, when that hold on it runs out —
  // see src/lib/edition-reservations.ts. Null/undefined for "no preference".
  reservedUntil?: string | null;
};

// A cart line's real identity is which print AND which specific number (if
// any) was chosen — not just the print — so a customer can hold two
// different numbered copies of the same print as two separate lines (e.g.
// "Ursa Occasus #13" and "Ursa Occasus #47") rather than only ever having
// one line per print. "No preference" purchases of the same print still
// collapse into a single line with a quantity, since there's nothing
// distinguishing one unnumbered copy from another.
export function cartLineKey(printId: string, requestedEditionNumber?: number | null): string {
  return requestedEditionNumber != null ? `${printId}#${requestedEditionNumber}` : printId;
}

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (printId: string, requestedEditionNumber?: number | null) => void;
  updateQuantity: (printId: string, requestedEditionNumber: number | null | undefined, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotalMinor: number;
  // True once the cart has finished reading its saved contents back from
  // localStorage. Callers that need to clear the cart on mount (like the
  // checkout success page, landed on via a full page reload coming back
  // from Stripe) MUST wait for this — clearing before hydration finishes
  // gets silently overwritten a moment later when hydration restores
  // whatever was saved before checkout.
  hydrated: boolean;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "slowlydownward_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupt cart data
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable — cart just won't persist across reloads
    }
  }, [items, hydrated]);

  function addItem(item: CartItem) {
    setItems((prev) => {
      const key = cartLineKey(item.printId, item.requestedEditionNumber);
      const existing = prev.find((i) => cartLineKey(i.printId, i.requestedEditionNumber) === key);
      if (existing) {
        // Same line already exists — either the exact same specific number
        // (re-picking it just refreshes the hold) or a second "no
        // preference" add for the same print (which really does mean "one
        // more, don't care which", so those quantities add up). A specific
        // number's own quantity is always exactly 1 — there's only one
        // physical copy of any given number — so that always replaces
        // rather than accumulates.
        return prev.map((i) =>
          cartLineKey(i.printId, i.requestedEditionNumber) === key
            ? { ...i, ...item, quantity: item.requestedEditionNumber != null ? item.quantity : i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }

  function removeItem(printId: string, requestedEditionNumber?: number | null) {
    setItems((prev) => {
      const key = cartLineKey(printId, requestedEditionNumber);
      // Free up a reserved edition number straight away, rather than making
      // everyone else wait out the rest of its hold — best-effort, since the
      // hold expires on its own regardless if this fails.
      const item = prev.find((i) => cartLineKey(i.printId, i.requestedEditionNumber) === key);
      if (item?.requestedEditionNumber && item.reservedUntil) {
        fetch("/api/editions/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printId,
            number: item.requestedEditionNumber,
            token: getReservationToken(),
          }),
        }).catch(() => {});
      }
      return prev.filter((i) => cartLineKey(i.printId, i.requestedEditionNumber) !== key);
    });
  }

  function updateQuantity(printId: string, requestedEditionNumber: number | null | undefined, quantity: number) {
    if (quantity <= 0) {
      removeItem(printId, requestedEditionNumber);
      return;
    }
    const key = cartLineKey(printId, requestedEditionNumber);
    setItems((prev) => prev.map((i) => (cartLineKey(i.printId, i.requestedEditionNumber) === key ? { ...i, quantity } : i)));
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalMinor = items.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clear, count, subtotalMinor, hydrated }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
