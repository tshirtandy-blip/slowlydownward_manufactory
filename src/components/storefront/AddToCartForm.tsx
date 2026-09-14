"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { getReservationToken } from "@/lib/reservation-token";
import { formatCountdown, isCountdownUrgent } from "@/lib/format-countdown";

export function AddToCartForm({
  printId,
  slug,
  title,
  priceMinor,
  currency,
  imageUrl,
  availableNumbers,
  editionSize,
  pickerNote,
}: {
  printId: string;
  slug: string;
  title: string;
  priceMinor: number;
  currency: string;
  imageUrl?: string;
  availableNumbers: number[];
  /** Null means an open edition — not limited or numbered, so there's
   * nothing to request a specific copy of and nothing to sell out of. */
  editionSize: number | null;
  /** Admin-editable text shown next to the edition number picker — see
   * Admin > Settings > Editions, which is also where the actual hold
   * duration is set (applied server-side when the reservation is made). */
  pickerNote: string;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [requested, setRequested] = useState<string>("random");
  const [added, setAdded] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const isOpenEdition = editionSize === null;
  const soldOut = !isOpenEdition && availableNumbers.length === 0;

  // Ticks the "reserved for N:NN more" countdown once something's actually
  // been reserved — otherwise this component does nothing on a timer.
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const msLeftForExpiry = expiresAt ? expiresAt.getTime() - now : null;
  const expired = msLeftForExpiry !== null && msLeftForExpiry <= 0;

  // The moment a hold actually runs out, drop straight back to the picker
  // (rather than sitting on a dead "View cart" screen with a number that
  // may no longer be theirs) so trying again is a single click away — with
  // a short note explaining why it reset.
  useEffect(() => {
    if (!expired) return;
    setAdded(false);
    setRequested("random");
    setExpiresAt(null);
    setError("Your hold on that number ran out — please pick again.");
    router.refresh(); // the available-numbers list may have changed while it was held
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  async function handleAdd() {
    setError(null);
    // Read straight from the reserve response below, rather than the
    // `expiresAt` state — setting state here doesn't update that variable
    // until the next render, so the addItem() call further down was always
    // reading the OLD value (null, the first time through) and silently
    // sending no expiry at all. That's why the cart's countdown never
    // actually appeared.
    let reservedUntilIso: string | null = null;

    if (requested !== "random") {
      setReserving(true);
      const token = getReservationToken();
      try {
        const res = await fetch("/api/editions/reserve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ printId, number: Number(requested), token }),
        });
        const data = await res.json().catch(() => ({}) as any);
        if (!res.ok) {
          setError(data.error || "Sorry, that number just became unavailable — please pick another.");
          setReserving(false);
          setRequested("random");
          router.refresh(); // re-fetch the available-numbers list from the server
          return;
        }
        reservedUntilIso = data.expiresAt;
        setExpiresAt(new Date(data.expiresAt));
        setNow(Date.now());
      } catch {
        setError("Couldn't reserve that number — please check your connection and try again.");
        setReserving(false);
        return;
      }
      setReserving(false);
    }

    addItem({
      printId,
      slug,
      title,
      priceMinor,
      currency,
      imageUrl,
      quantity: 1,
      requestedEditionNumber: requested === "random" ? null : Number(requested),
      reservedUntil: reservedUntilIso,
    });
    setAdded(true);
  }

  // Brings the picker back for a second (or third...) copy of this same
  // print — a different number, or another "no preference" one — without
  // losing the copy(s) already added. The one just added is already safely
  // in the cart (with its own hold ticking down there), so resetting this
  // form's own local state is all that's needed.
  function handleAddAnother() {
    setAdded(false);
    setRequested("random");
    setExpiresAt(null);
    setError(null);
    router.refresh(); // the available-numbers list has one fewer number now
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
      {!isOpenEdition && availableNumbers.length > 0 && !added && (
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
          {requested !== "random" && pickerNote && (
            <p className="text-xs text-stone mt-2 max-w-xs">{pickerNote}</p>
          )}
        </div>
      )}

      {added && requested !== "random" && expiresAt && !expired && (
        <p
          className={
            isCountdownUrgent(msLeftForExpiry!)
              ? "text-xs text-accent font-medium mb-4"
              : "text-xs text-stone mb-4"
          }
        >
          Reserved for you — complete checkout within {formatCountdown(msLeftForExpiry!)} or it may be
          released to someone else.
        </p>
      )}

      {error && <p className="text-sm text-accent mb-4 max-w-xs">{error}</p>}

      <div className="flex items-center gap-4">
        {!added && (
          <button onClick={handleAdd} disabled={reserving} className="btn-primary disabled:opacity-50">
            {reserving ? "Reserving…" : "Add to cart"}
          </button>
        )}
        {added && (
          <>
            <button onClick={handleAddAnother} className="btn-secondary">
              Add another copy
            </button>
            <button onClick={() => router.push("/cart")} className="btn-primary">
              View cart
            </button>
          </>
        )}
      </div>
    </div>
  );
}
