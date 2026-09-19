"use client";

import { useState, useTransition } from "react";
import { updateOrderItemProduct } from "@/app/admin/(protected)/orders/[id]/actions";

/** Inline "re-point this line item to a different print / fix its price"
 * control on the order detail page — see updateOrderItemProduct in
 * orders/[id]/actions.ts. Mainly for correcting a historical order (see
 * scripts/import-shopify-orders.ts) whose item landed on an auto-created
 * placeholder print because the Shopify product couldn't be matched, but
 * left generally available on any order rather than gated to just
 * imported ones — the action itself doesn't care which. */
export function OrderItemEditor({
  orderItemId,
  currentPrintId,
  currentUnitPriceMinor,
  currentCurrency,
  prints,
}: {
  orderItemId: string;
  currentPrintId: string;
  currentUnitPriceMinor: number;
  currentCurrency: string;
  prints: { id: string; title: string; slug: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [printId, setPrintId] = useState(currentPrintId);
  const [priceInput, setPriceInput] = useState((currentUnitPriceMinor / 100).toFixed(2));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-stone underline hover:text-ink"
      >
        Edit
      </button>
    );
  }

  function handleSave() {
    setError(null);
    const price = Number(priceInput);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }
    startTransition(async () => {
      const result = await updateOrderItemProduct(orderItemId, {
        printId,
        unitPriceMinor: Math.round(price * 100),
      });
      if (result.ok) {
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-1">
      <select
        value={printId}
        onChange={(e) => setPrintId(e.target.value)}
        className="block w-full border border-line bg-white px-1 py-0.5 text-xs"
      >
        {prints.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title} ({p.slug})
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <span className="text-xs text-stone">{currentCurrency}</span>
        <input
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          inputMode="decimal"
          className="w-20 border border-line bg-white px-1 py-0.5 text-xs"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="text-xs text-stone underline hover:text-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="text-xs text-stone underline hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
