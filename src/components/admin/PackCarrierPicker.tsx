"use client";

import { useEffect, useState, useTransition } from "react";
import type { PackCarrier, PackOverrides } from "@/app/admin/(protected)/pack/actions";
import { formatMinor } from "@/lib/money";
import { ShippingLabelPreview } from "./ShippingLabelPreview";

type CarrierQuote = { amountMinor: number; currency: string; service: string; overWeight?: boolean } | null;
type Dims = { lengthCm: number; widthCm: number; heightCm: number };

const dimInputClass = "block w-16 border hairline bg-transparent px-2 py-1 text-sm";

export function PackCarrierPicker({
  orderId,
  packAction,
  royalMail,
  royalMailError,
  ups,
  upsError,
  currency,
  requiresCustoms,
  defaultDims,
  defaultCustomsValueMinor,
}: {
  orderId: string;
  packAction: (
    orderId: string,
    carrier: PackCarrier,
    overrides?: PackOverrides
  ) => Promise<
    { ok: true; labelWarning?: string; labelUrl?: string; trackingNumber?: string } | { ok: false; error: string }
  >;
  royalMail: CarrierQuote;
  royalMailError: string | null;
  ups: CarrierQuote;
  upsError: string | null;
  currency: string;
  requiresCustoms: boolean;
  defaultDims: Dims;
  defaultCustomsValueMinor: number;
}) {
  const [carrier, setCarrier] = useState<PackCarrier>(royalMail ? "ROYAL_MAIL" : ups ? "UPS" : "COLLECTION");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    done: boolean;
    warning?: string;
    error?: string;
    labelUrl?: string;
    trackingNumber?: string;
  }>({ done: false });

  // "Confirm parcel size and customs value" is only needed for a UPS
  // shipment leaving the UK — a UK-bound UPS parcel, Royal Mail, or a
  // customer collection go straight to "Mark packed & create label".
  const needsConfirmStep = carrier === "UPS" && requiresCustoms;
  const [confirmed, setConfirmed] = useState(false);
  const [lengthCm, setLengthCm] = useState(String(defaultDims.lengthCm));
  const [widthCm, setWidthCm] = useState(String(defaultDims.widthCm));
  const [heightCm, setHeightCm] = useState(String(defaultDims.heightCm));
  const [customsValue, setCustomsValue] = useState((defaultCustomsValueMinor / 100).toFixed(2));

  // Switching carrier invalidates any earlier confirmation (e.g. away from
  // UPS and back).
  useEffect(() => {
    setConfirmed(false);
  }, [carrier]);

  if (result.done) {
    return (
      <div>
        <span className="label-caps text-stone">
          Packed via {carrier === "ROYAL_MAIL" ? "Royal Mail" : carrier === "UPS" ? "UPS" : "Collection"}
        </span>
        {result.warning && <p className="text-xs text-accent mt-1">{result.warning}</p>}
        <div className="mt-2">
          <ShippingLabelPreview labelUrl={result.labelUrl} trackingNumber={result.trackingNumber} carrier={carrier} />
        </div>
      </div>
    );
  }

  function overridesFromFields(): PackOverrides | undefined {
    if (!needsConfirmStep) return undefined;
    const parsedValueMinor = Math.round(Number(customsValue) * 100);
    return {
      lengthCm: Number(lengthCm) > 0 ? Number(lengthCm) : defaultDims.lengthCm,
      widthCm: Number(widthCm) > 0 ? Number(widthCm) : defaultDims.widthCm,
      heightCm: Number(heightCm) > 0 ? Number(heightCm) : defaultDims.heightCm,
      customsValueMinor: Number.isFinite(parsedValueMinor) && parsedValueMinor >= 0 ? parsedValueMinor : undefined,
    };
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await packAction(orderId, carrier, overridesFromFields());
      if (res.ok) {
        setResult({ done: true, warning: res.labelWarning, labelUrl: res.labelUrl, trackingNumber: res.trackingNumber });
      } else {
        setResult({ done: false, error: res.error });
      }
    });
  }

  const showConfirmPanel = needsConfirmStep && !confirmed;

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

      {showConfirmPanel && (
        <div className="border hairline bg-line/20 p-3 mb-3 space-y-2">
          <p className="label-caps text-stone">Confirm parcel size and customs value</p>
          <p className="text-xs text-stone">
            This order is shipping outside the UK, so UPS needs customs paperwork attached electronically. Check the
            figures below — pre-filled from the ordered print(s) — then confirm to create the label.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-stone">
              Length (cm)
              <input type="number" min="1" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} className={dimInputClass} />
            </label>
            <label className="text-xs text-stone">
              Width (cm)
              <input type="number" min="1" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} className={dimInputClass} />
            </label>
            <label className="text-xs text-stone">
              Height (cm)
              <input type="number" min="1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={dimInputClass} />
            </label>
            <label className="text-xs text-stone">
              Customs value ({currency})
              <input
                type="number"
                min="0"
                step="0.01"
                value={customsValue}
                onChange={(e) => setCustomsValue(e.target.value)}
                className="block w-24 border hairline bg-transparent px-2 py-1 text-sm"
              />
            </label>
          </div>
          <button type="button" onClick={() => setConfirmed(true)} className="btn-secondary !px-4 !py-2 text-sm">
            Confirm
          </button>
        </div>
      )}

      {result.error && <p className="text-xs text-accent mb-2">{result.error}</p>}

      {!showConfirmPanel && (
        <button onClick={handleSubmit} disabled={pending} className="btn-secondary !px-4 !py-2 disabled:opacity-50">
          {pending ? "Packing…" : "Mark packed & create label"}
        </button>
      )}
    </div>
  );
}
