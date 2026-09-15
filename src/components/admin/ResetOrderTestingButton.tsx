"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetOrderForTesting } from "@/app/admin/(protected)/orders/[id]/actions";

/** TEMPORARY: lets Andrew re-run the packing/label flow against this same
 * order instead of creating and paying for a fresh manual order each time
 * while testing. Remove once packing/labels are confirmed working and no
 * longer need repeat testing — see resetOrderForTesting in
 * src/app/admin/(protected)/orders/[id]/actions.ts. */
export function ResetOrderTestingButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !window.confirm(
        "Testing only: reset this order back to Paid and clear its carrier/tracking/label so it reappears on the packing queue?"
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetOrderForTesting(orderId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="border border-dashed border-accent p-3 mt-6">
      <p className="label-caps text-accent mb-1">Testing only</p>
      <p className="text-xs text-stone mb-2">
        Puts this order back to "Paid" and clears its carrier, tracking number and label, so you can send it through
        the packing queue again without creating a new order.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs underline text-accent hover:opacity-70 disabled:opacity-50"
      >
        {pending ? "Resetting…" : "Reset order for testing"}
      </button>
      {error && <p className="text-xs text-accent mt-2">{error}</p>}
    </div>
  );
}
