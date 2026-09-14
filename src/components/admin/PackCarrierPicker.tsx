"use client";

import { useState, useTransition } from "react";
import type { PackCarrier } from "@/app/admin/(protected)/pack/actions";
import { formatMinor } from "@/lib/money";

type CarrierQuote = { amountMinor: number; currency: string; service: string; overWeight?: boolean } | null;

export function PackCarrierPicker({
  orderId,
  packAction,
  royalMail,
  royalMailError,
  ups,
  upsError,
}: {
  orderId: string;
  packAction: (orderId: string, carrier: PackCarrier) => Promise<{ ok: true; labelWarning?: string } | { ok: false; error: string }>;
  royalMail: CarrierQuote;
  royalMailError: string | null;
  ups: CarrierQuote;
  upsError: string | null;
}) {
  const [carrier, setCarrier] = useState<PackCarrier>(royalMail ? "ROYAL_MAIL" : ups ? "UPS" : "COLLECTION");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ done: boolean; warning?: string; error?: string }>({ done: false });

  if (result.done) {
    return (
      <div>
        <span className="label-caps text-stone">Packed via {carrier === "ROYAL_MAIL" ? "Royal Mail" : carrier === "UPS" ? "UPS" : "Collection"}</span>
        {result.warning && <p className="text-xs text-accent mt-1">{result.warning}</p>}
      </div>
    );
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await packAction(orderId, carrier);
      if (res.ok) {
        setResult({ done: true, warning: res.labelWarning });
      } else {
        setResult({ done: false, error: res.error });
      }
    });
  }

  return (
    <div>
      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-3 text-sm">
          <input type="radio" name={`carrier-${orderId}`} checked={carrier === "ROYAL_MAIL"} onChange={() => setCarrier("ROYAL_MAIL")} disabled={!royalMail} />
          <span className="w-24">Royal Mail</span>
          {royalMail ? (
            <span className="text-stone">
              <span className="font-medium">{formatMinor(royalMail.amountMinor, royalMail.currency)}</span>{" "}
              {royalMail.service}
              {royalMail.overWeight && <span className="text-accent"> (bigger/heavier than your price list — estimated)</span>}
            </span>
          ) : (
            <span className="text-stone/60">{royalMailError}</span>
          )}
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="radio"
            name={`carrier-${orderId}`}
            checked={carrier === "UPS"}
            onChange={() => setCarrier("UPS")}
            disabled={!ups}
          />
          <span className="w-24">UPS</span>
          {ups ? (
            <span className="text-stone">
              <span className="font-medium">{formatMinor(ups.amountMinor, ups.currency)}</span> {ups.service}
            </span>
          ) : (
            <span className="text-stone/60">{upsError}</span>
          )}
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="radio" name={`carrier-${orderId}`} checked={carrier === "COLLECTION"} onChange={() => setCarrier("COLLECTION")} />
          <span className="w-24">Collection</span>
          <span className="text-stone">Customer collecting in person — no label needed</span>
        </label>
      </div>

      {result.error && <p className="text-xs text-accent mb-2">{result.error}</p>}

      <button onClick={handleSubmit} disabled={pending} className="btn-secondary !px-4 !py-2 disabled:opacity-50">
        {pending ? "Packing…" : "Mark packed & create label"}
      </button>
    </div>
  );
}
