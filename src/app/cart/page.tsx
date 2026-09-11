"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatMinor } from "@/lib/money";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotalMinor } = useCart();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          items: items.map((i) => ({
            printId: i.printId,
            quantity: i.quantity,
            requestedEditionNumber: i.requestedEditionNumber ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl mb-10">Your cart</h1>

        {items.length === 0 ? (
          <p className="text-stone">Your cart is empty.</p>
        ) : (
          <div className="space-y-6">
            {items.map((item) => (
              <div key={item.printId} className="flex items-center justify-between border-b hairline pb-4">
                <div>
                  <p className="font-display">{item.title}</p>
                  <p className="label-caps mt-1">
                    {item.requestedEditionNumber ? `Requested #${item.requestedEditionNumber}` : "Random edition"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.printId, Number(e.target.value))}
                    className="w-16 border hairline bg-transparent px-2 py-1 text-sm text-center"
                  />
                  <span className="w-24 text-right">{formatMinor(item.priceMinor * item.quantity, item.currency)}</span>
                  <button onClick={() => removeItem(item.printId)} className="label-caps text-stone hover:text-accent">
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="flex justify-between pt-4 text-lg">
              <span>Subtotal</span>
              <span>{formatMinor(subtotalMinor, items[0]?.currency ?? "GBP")}</span>
            </div>
            <p className="text-sm text-stone">Shipping is calculated at checkout.</p>

            <div className="pt-6">
              <label className="label-caps block mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border hairline bg-transparent px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:border-ink"
              />
            </div>

            {error && <p className="text-sm text-accent">{error}</p>}

            <button onClick={handleCheckout} disabled={loading} className="btn-primary mt-4 disabled:opacity-50">
              {loading ? "Redirecting to Stripe…" : "Checkout with Stripe"}
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </>
  );
}
