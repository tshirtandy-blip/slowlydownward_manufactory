"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { formatMinor } from "@/lib/money";
import { createManualOrderAction } from "@/app/admin/(protected)/orders/new/actions";

type PrintOption = {
  id: string;
  title: string;
  published: boolean;
  editionSize: number | null;
  priceMinor: number;
  currency: string;
};

type ZoneRow = { key: string; label: string; priceMinor: number; countryCodes: string[]; sortOrder: number };

type DraftItem = {
  key: string;
  printId: string;
  title: string;
  requestedEditionNumber: number | null;
  quantity: number;
  priceMinor: number;
  currency: string;
};

// Same "your usual markets first" ordering as the storefront cart's country
// picker (src/app/cart/CartPageClient.tsx) — keeps the two dropdowns feeling
// like the same product.
const PRIORITY_COUNTRY_CODES = ["GB", "US", "AU", "CA", "FR", "JP", "NL", "DE", "ES", "IE", "IT", "NZ"];

export function ManualOrderForm({ prints, zones }: { prints: PrintOption[]; zones: ZoneRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // The "add an item" row's own local state.
  const [selectedPrintId, setSelectedPrintId] = useState("");
  const [printInfo, setPrintInfo] = useState<{
    isOpenEdition: boolean;
    available: number[];
    editionSize: number | null;
    title: string;
    priceMinor: number;
    currency: string;
  } | null>(null);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pendingNumber, setPendingNumber] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(1);

  const shippableCountries = useMemo(() => {
    const rows = COUNTRIES.map((c) => {
      const zone = zones.find((z) => z.countryCodes.includes(c.code));
      return zone ? { code: c.code, name: c.name, zoneLabel: zone.label, priceMinor: zone.priceMinor } : null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    return rows.sort((a, b) => {
      const aPriority = PRIORITY_COUNTRY_CODES.indexOf(a.code);
      const bPriority = PRIORITY_COUNTRY_CODES.indexOf(b.code);
      if (aPriority !== -1 || bPriority !== -1) {
        return (aPriority === -1 ? PRIORITY_COUNTRY_CODES.length : aPriority) -
          (bPriority === -1 ? PRIORITY_COUNTRY_CODES.length : bPriority);
      }
      return a.name.localeCompare(b.name);
    });
  }, [zones]);

  const subtotalMinor = items.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0);
  const shippingMinor = shippableCountries.find((c) => c.code === country)?.priceMinor ?? 0;

  async function handleSelectPrint(printId: string) {
    setSelectedPrintId(printId);
    setPrintInfo(null);
    setPickError(null);
    setPendingNumber("");
    setPendingQuantity(1);
    if (!printId) return;
    setLoadingPrint(true);
    try {
      const res = await fetch(`/api/admin/editions/available?printId=${printId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load that print.");
      setPrintInfo(data);
    } catch (e: any) {
      setPickError(e.message || "Couldn't load that print.");
    } finally {
      setLoadingPrint(false);
    }
  }

  function handleAddItem() {
    if (!printInfo) return;
    if (!printInfo.isOpenEdition) {
      if (!pendingNumber) {
        setPickError("Pick an edition number.");
        return;
      }
      const number = Number(pendingNumber);
      const key = `${selectedPrintId}#${number}`;
      if (items.some((i) => i.key === key)) {
        setPickError("That edition number is already in this order.");
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          key,
          printId: selectedPrintId,
          title: printInfo.title,
          requestedEditionNumber: number,
          quantity: 1,
          priceMinor: printInfo.priceMinor,
          currency: printInfo.currency,
        },
      ]);
      // Same print can be added again straight away with a different number.
      setPrintInfo({ ...printInfo, available: printInfo.available.filter((n) => n !== number) });
      setPendingNumber("");
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: `${selectedPrintId}-open-${Date.now()}`,
          printId: selectedPrintId,
          title: printInfo.title,
          requestedEditionNumber: null,
          quantity: Math.max(1, Math.min(20, pendingQuantity)),
          priceMinor: printInfo.priceMinor,
          currency: printInfo.currency,
        },
      ]);
      setSelectedPrintId("");
      setPrintInfo(null);
    }
  }

  function handleRemoveItem(key: string) {
    const removed = items.find((i) => i.key === key);
    setItems((prev) => prev.filter((i) => i.key !== key));
    // Nothing is actually claimed in the database until the order is
    // created (see the submit handler) — so a removed number just goes
    // back into this dropdown, no server round-trip needed.
    if (removed?.requestedEditionNumber != null && removed.printId === selectedPrintId && printInfo) {
      setPrintInfo({
        ...printInfo,
        available: [...printInfo.available, removed.requestedEditionNumber].sort((a, b) => a - b),
      });
    }
  }

  function handleSubmit() {
    setFormError(null);
    if (!email.trim()) return setFormError("Enter the client's email address.");
    if (!country) return setFormError("Choose where this is shipping to.");
    if (items.length === 0) return setFormError("Add at least one item.");

    startTransition(async () => {
      const result = await createManualOrderAction({
        customerEmail: email,
        country,
        note: note || undefined,
        items: items.map((i) => ({
          printId: i.printId,
          requestedEditionNumber: i.requestedEditionNumber,
          quantity: i.quantity,
        })),
      });
      if (result.ok) {
        router.push(`/admin/orders/${result.orderId}`);
      } else {
        setFormError(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-caps block mb-2">Client email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border hairline bg-transparent px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="label-caps block mb-2">Ship to</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border hairline bg-transparent px-3 py-2 text-sm w-full"
          >
            <option value="">Choose a country…</option>
            {shippableCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} — {formatMinor(c.priceMinor)} shipping
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label-caps block mb-2">Internal note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. sold via Instagram DM, client wants tracked shipping"
          className="border hairline bg-transparent px-3 py-2 text-sm w-full"
        />
      </div>

      <div className="border hairline p-5">
        <h2 className="label-caps mb-4">Add an item</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="label-caps block mb-2">Print</label>
            <select
              value={selectedPrintId}
              onChange={(e) => handleSelectPrint(e.target.value)}
              className="border hairline bg-transparent px-3 py-2 text-sm w-full"
            >
              <option value="">Choose a print…</option>
              {prints.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {!p.published ? " (not published)" : ""} — {formatMinor(p.priceMinor, p.currency)}
                </option>
              ))}
            </select>
          </div>

          {loadingPrint && <p className="text-sm text-stone pb-2">Loading…</p>}

          {printInfo && !printInfo.isOpenEdition && (
            <div>
              <label className="label-caps block mb-2">Edition number</label>
              <select
                value={pendingNumber}
                onChange={(e) => setPendingNumber(e.target.value)}
                className="border hairline bg-transparent px-3 py-2 text-sm w-32"
              >
                <option value="">
                  {printInfo.available.length === 0 ? "None available" : "Choose…"}
                </option>
                {printInfo.available.map((n) => (
                  <option key={n} value={n}>
                    #{n} / {printInfo.editionSize}
                  </option>
                ))}
              </select>
            </div>
          )}

          {printInfo && printInfo.isOpenEdition && (
            <div>
              <label className="label-caps block mb-2">Quantity</label>
              <input
                type="number"
                min={1}
                max={20}
                value={pendingQuantity}
                onChange={(e) => setPendingQuantity(Number(e.target.value))}
                className="border hairline bg-transparent px-3 py-2 text-sm w-20"
              />
            </div>
          )}

          {printInfo && (
            <button type="button" onClick={handleAddItem} className="btn-secondary">
              Add to order
            </button>
          )}
        </div>
        {pickError && <p className="text-sm text-accent mt-3">{pickError}</p>}
      </div>

      {items.length > 0 && (
        <div className="border hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="label-caps text-left border-b hairline">
                <th className="p-3">Item</th>
                <th className="p-3">Price</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.key} className="border-b hairline last:border-0">
                  <td className="p-3">
                    {i.title}
                    {i.requestedEditionNumber ? ` — edition #${i.requestedEditionNumber}` : ` — qty ${i.quantity}`}
                  </td>
                  <td className="p-3">{formatMinor(i.priceMinor * i.quantity, i.currency)}</td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => handleRemoveItem(i.key)} className="text-xs underline text-stone hover:text-ink">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 border-t hairline text-sm flex flex-col items-end gap-1">
            <p>Subtotal: {formatMinor(subtotalMinor)}</p>
            <p>Shipping: {country ? formatMinor(shippingMinor) : "—"}</p>
            <p className="font-medium">Total: {formatMinor(subtotalMinor + shippingMinor)}</p>
          </div>
        </div>
      )}

      {formError && <p className="text-sm text-accent">{formError}</p>}

      <button type="button" onClick={handleSubmit} disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "Creating…" : "Create order & send payment link"}
      </button>
    </div>
  );
}
