"use client";

import { useEffect, useState, useTransition } from "react";
import type { PackCarrier, PackOverrides } from "@/app/admin/(protected)/pack/actions";
import { formatMinor } from "@/lib/money";
import { ShippingLabelPreview } from "./ShippingLabelPreview";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CarrierQuote = { amountMinor: number; currency: string; service: string; overWeight?: boolean } | null;
type Dims = { lengthCm: number; widthCm: number; heightCm: number };

const dimInputClass = "block w-16 border border-input bg-background px-2 py-1 text-sm";

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
        {result.warning && <p className="mt-1 text-xs text-accent">{result.warning}</p>}
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
      try {
        const res = await packAction(orderId, carrier, overridesFromFields());
        if (res.ok) {
          setResult({ done: true, warning: res.labelWarning, labelUrl: res.labelUrl, trackingNumber: res.trackingNumber });
        } else {
          setResult({ done: false, error: res.error });
        }
      } catch (err) {
        // A network hiccup or a cold-start error can reject the action
        // outright rather than returning { ok: false } — caught here so it
        // shows as a message that stays on screen, not a browser error
        // toast that's easy to miss.
        setResult({ done: false, error: err instanceof Error ? err.message : "Something went wrong creating the label. Try again." });
      }
    });
  }

  const showConfirmPanel = needsConfirmStep && !confirmed;

  return (
    <div>
      <div className="mb-4 space-y-2">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="radio"
            name={`carrier-${orderId}`}
            checked={carrier === "ROYAL_MAIL"}
            onChange={() => setCarrier("ROYAL_MAIL")}
            disabled={!royalMail}
            className="accent-ink"
          />
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
            className="accent-ink"
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
          <input
            type="radio"
            name={`carrier-${orderId}`}
            checked={carrier === "COLLECTION"}
            onChange={() => setCarrier("COLLECTION")}
            className="accent-ink"
          />
          <span className="w-24">Collection</span>
          <span className="text-stone">Customer collecting in person — no label needed</span>
        </label>
      </div>

      {showConfirmPanel && (
        <Card className="mb-3 border-line bg-line/20 shadow-none">
          <CardContent className="space-y-2 p-3">
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
                  className="block w-24 border border-input bg-background px-2 py-1 text-sm"
                />
              </label>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmed(true)}>
              Confirm
            </Button>
          </CardContent>
        </Card>
      )}

      {result.error && <p className="mb-2 text-xs text-accent">{result.error}</p>}

      {!showConfirmPanel && (
        <Button variant="secondary" onClick={handleSubmit} disabled={pending}>
          {pending ? "Packing…" : "Mark packed & create label"}
        </Button>
      )}
    </div>
  );
}
