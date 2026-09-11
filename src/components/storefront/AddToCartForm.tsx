"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";

export function AddToCartForm({
  printId,
  slug,
  title,
  priceMinor,
  currency,
  imageUrl,
  availableNumbers,
}: {
  printId: string;
  slug: string;
  title: string;
  priceMinor: number;
  currency: string;
  imageUrl?: string;
  availableNumbers: number[];
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [requested, setRequested] = useState<string>("random");
  const [added, setAdded] = useState(false);

  const soldOut = availableNumbers.length === 0;

  function handleAdd() {
    addItem({
      printId,
      slug,
      title,
      priceMinor,
      currency,
      imageUrl,
      quantity: 1,
      requestedEditionNumber: requested === "random" ? null : Number(requested),
    });
    setAdded(true);
  }

  if (soldOut) {
    return (
      <button disabled className="btn-secondary opacity-40 cursor-not-allowed">
        Sold out
      </button>
    );
  }

  return (
    <div>
      {availableNumbers.length > 0 && (
        <div className="mb-4">
          <label className="label-caps block mb-2">Edition number</label>
          <select
            value={requested}
            onChange={(e) => setRequested(e.target.value)}
            className="border hairline bg-transparent px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:border-ink"
          >
            <option value="random">No preference — random available copy</option>
            {availableNumbers.map((n) => (
              <option key={n} value={n}>
                #{n}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={handleAdd} className="btn-primary">
          Add to cart
        </button>
        {added && (
          <button onClick={() => router.push("/cart")} className="label-caps underline">
            View cart
          </button>
        )}
      </div>
    </div>
  );
}
