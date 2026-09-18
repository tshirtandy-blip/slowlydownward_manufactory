"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { formatMinor } from "@/lib/money";
import { createManualOrderAction } from "@/app/admin/(protected)/orders/new/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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

const selectClass =
  "flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
          <Label htmlFor="moEmail" className="label-caps mb-2 block">
            Client email
          </Label>
          <Input id="moEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-line" />
        </div>
        <div>
          <Label htmlFor="moCountry" className="label-caps mb-2 block">
            Ship to
          </Label>
          <select id="moCountry" value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
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
        <Label htmlFor="moNote" className="label-caps mb-2 block">
          Internal note (optional)
        </Label>
        <Textarea
          id="moNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. sold via Instagram DM, client wants tracked shipping"
          className="border-line"
        />
      </div>

      <Card className="border-line shadow-none">
        <CardContent className="p-5">
          <h2 className="label-caps mb-4">Add an item</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="moPrint" className="label-caps mb-2 block">
                Print
              </Label>
              <select
                id="moPrint"
                value={selectedPrintId}
                onChange={(e) => handleSelectPrint(e.target.value)}
                className={selectClass}
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

            {loadingPrint && <p className="pb-2 text-sm text-stone">Loading…</p>}

            {printInfo && !printInfo.isOpenEdition && (
              <div>
                <Label htmlFor="moEditionNumber" className="label-caps mb-2 block">
                  Edition number
                </Label>
                <select
                  id="moEditionNumber"
                  value={pendingNumber}
                  onChange={(e) => setPendingNumber(e.target.value)}
                  className={`${selectClass} w-32`}
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
                <Label htmlFor="moQuantity" className="label-caps mb-2 block">
                  Quantity
                </Label>
                <Input
                  id="moQuantity"
                  type="number"
                  min={1}
                  max={20}
                  value={pendingQuantity}
                  onChange={(e) => setPendingQuantity(Number(e.target.value))}
                  className="w-20 border-line"
                />
              </div>
            )}

            {printInfo && (
              <Button type="button" variant="secondary" onClick={handleAddItem}>
                Add to order
              </Button>
            )}
          </div>
          {pickError && <p className="mt-3 text-sm text-accent">{pickError}</p>}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card className="border-line shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-line">
                  <TableHead className="label-caps">Item</TableHead>
                  <TableHead className="label-caps">Price</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.key} className="border-line">
                    <TableCell>
                      {i.title}
                      {i.requestedEditionNumber ? ` — edition #${i.requestedEditionNumber}` : ` — qty ${i.quantity}`}
                    </TableCell>
                    <TableCell>{formatMinor(i.priceMinor * i.quantity, i.currency)}</TableCell>
                    <TableCell className="text-right">
                      <button type="button" onClick={() => handleRemoveItem(i.key)} className="text-xs text-stone underline hover:text-ink">
                        Remove
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-col items-end gap-1 border-t border-line p-3 text-sm">
              <p>Subtotal: {formatMinor(subtotalMinor)}</p>
              <p>Shipping: {country ? formatMinor(shippingMinor) : "—"}</p>
              <p className="font-medium">Total: {formatMinor(subtotalMinor + shippingMinor)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {formError && <p className="text-sm text-accent">{formError}</p>}

      <Button type="button" onClick={handleSubmit} disabled={pending}>
        {pending ? "Creating…" : "Create order & send payment link"}
      </Button>
    </div>
  );
}
