"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type CartItem = {
  printId: string;
  slug: string;
  title: string;
  priceMinor: number;
  currency: string;
  imageUrl?: string;
  quantity: number;
  requestedEditionNumber?: number | null;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (printId: string) => void;
  updateQuantity: (printId: string, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotalMinor: number;
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
      const existing = prev.find((i) => i.printId === item.printId);
      if (existing) {
        return prev.map((i) =>
          i.printId === item.printId ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  }

  function removeItem(printId: string) {
    setItems((prev) => prev.filter((i) => i.printId !== printId));
  }

  function updateQuantity(printId: string, quantity: number) {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.printId !== printId)
        : prev.map((i) => (i.printId === printId ? { ...i, quantity } : i))
    );
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalMinor = items.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clear, count, subtotalMinor }}
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
