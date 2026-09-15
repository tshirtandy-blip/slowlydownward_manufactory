"use client";

import { useState, useTransition } from "react";
import { requestOrderWithdrawal } from "./actions";

/** The EU/UK "right to cancel" button, shown against a single order on
 * the customer's own order history page. Clicking it doesn't withdraw
 * anything by itself — it opens a confirmation step repeating the
 * contract details (order number, date, items, total, all already on the
 * order card above this) with its own separate "Confirm withdrawal"
 * button, which is what the law actually requires: a distinct
 * confirmation function, not a single click. */
export function OrderWithdrawalAction({
  orderId,
  orderNumber,
  placedOn,
  totalFormatted,
  withdrawalPeriodDays,
}: {
  orderId: string;
  orderNumber: string;
  placedOn: string;
  totalFormatted: string;
  withdrawalPeriodDays: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function confirm() {
    startTransition(async () => {
      const res = await requestOrderWithdrawal(orderId, note);
      if (res.ok) {
        setResult({ ok: true, message: "Recorded — we've emailed you a confirmation and will be in touch." });
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  if (result?.ok) {
    return <p className="text-xs text-stone mt-3">{result.message}</p>;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs underline text-stone hover:text-ink mt-3"
      >
        Withdraw from contract
      </button>
    );
  }

  return (
    <div className="border hairline p-4 mt-3 bg-line/20">
      <p className="text-xs font-medium mb-2">Withdraw from order {orderNumber}?</p>
      <p className="text-xs text-stone mb-3">
        Placed {placedOn} for {totalFormatted}. Under your right to cancel you can withdraw from this contract within{" "}
        {withdrawalPeriodDays} days of delivery — no reason required. Confirming notifies us; we'll follow up about
        returning the item(s) and your refund.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything you'd like us to know (optional)"
        className="border hairline bg-transparent px-3 py-2 text-xs w-full mb-3 min-h-[3rem]"
      />
      {result && !result.ok && <p className="text-xs text-accent mb-3">{result.message}</p>}
      <div className="flex items-center gap-4">
        <button type="button" onClick={confirm} disabled={pending} className="btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50">
          {pending ? "Confirming…" : "Confirm withdrawal"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="text-xs underline text-stone hover:text-ink"
        >
          Never mind
        </button>
      </div>
    </div>
  );
}
