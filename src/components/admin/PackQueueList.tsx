"use client";

import { useState, useTransition } from "react";
import { PackCarrierPicker } from "./PackCarrierPicker";
import { generateCoaPdf, confirmEditionNumber, confirmAllPacked, printLabel } from "@/app/admin/(protected)/pack/actions";
import { openPdfInTab } from "@/lib/pdf-blob";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CarrierQuote = { amountMinor: number; currency: string; service: string; overWeight?: boolean } | null;

export type PackQueueRow = {
  id: string;
  orderNumber: string;
  shippingName: string | null;
  currency: string;
  items: {
    id: string;
    title: string;
    primaryImageUrl: string | null;
    editionLabel: string;
    drawerLocation: string | null;
    editionConfirmedByPacker: boolean;
    coaPrinted: boolean;
  }[];
  costs: {
    royalMail: CarrierQuote;
    royalMailError: string | null;
    ups: CarrierQuote;
    upsError: string | null;
    customsPlaceholder: boolean;
    requiresCustoms: boolean;
    defaultDims: { lengthCm: number; widthCm: number; heightCm: number };
    defaultCustomsValueMinor: number;
  };
};

/** Renders the packing queue from a snapshot taken when the page loaded —
 * deliberately kept in React state seeded ONLY on first mount, not re-read
 * from fresh props on every render. Confirming an order as packed (via the
 * server actions below) makes Next.js silently re-run this page's server
 * component afterwards regardless of which paths are revalidated, and
 * since a just-packed order no longer matches the "still awaiting
 * packing" query, a version of this list built straight from live server
 * data would drop that order's whole card — image, checkboxes, COA/label
 * buttons, or any error message included — before there was any real
 * chance to use it. Freezing the list here means a packed order just
 * stays in place until the packer next reloads or navigates back to this
 * page. Each order's own in-progress state (checkboxes ticked, COA
 * printed, confirmed packed) lives in PackOrderCard below, not here, so
 * one order's UI updates don't need to touch this frozen list at all. */
export function PackQueueList({ initialOrders }: { initialOrders: PackQueueRow[] }) {
  const [orders] = useState(initialOrders);

  return (
    <div className="space-y-6">
      {orders.map((order) => (
        <PackOrderCard key={order.id} order={order} />
      ))}

      {orders.length === 0 && <p className="text-stone text-center py-16">Nothing to pack right now.</p>}
    </div>
  );
}

function PackOrderCard({ order }: { order: PackQueueRow }) {
  const [items, setItems] = useState(order.items);
  const [confirmedPacked, setConfirmedPacked] = useState(false);
  const [coaPending, startCoaTransition] = useTransition();
  const [confirmPending, startConfirmTransition] = useTransition();
  const [coaError, setCoaError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const allCoaPrinted = items.every((item) => item.coaPrinted);
  const allConfirmed = items.every((item) => item.editionConfirmedByPacker);

  function handlePrintCoa() {
    setCoaError(null);
    // Open the tab synchronously, in direct response to the click — a
    // browser popup blocker will kill window.open() called after an
    // `await`, since by then it no longer looks like a direct user
    // gesture. Navigating this already-open tab once the PDF is ready
    // (below) sidesteps that.
    const popup = window.open("", "_blank", "width=650,height=800");

    startCoaTransition(async () => {
      const res = await generateCoaPdf(order.id);
      if (!res.ok) {
        setCoaError(res.error);
        popup?.close();
        return;
      }
      openPdfInTab(popup, res.pdfBase64);
      setItems((prev) => prev.map((item) => ({ ...item, coaPrinted: true })));
    });
  }

  function handleToggleEdition(itemId: string, checked: boolean) {
    setConfirmError(null);
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, editionConfirmedByPacker: checked } : item)));
    startConfirmTransition(async () => {
      const res = await confirmEditionNumber(itemId, checked);
      if (!res.ok) {
        // Revert the optimistic tick so the checkbox never silently lies
        // about what's actually saved.
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, editionConfirmedByPacker: !checked } : item))
        );
        setConfirmError(res.error);
      }
    });
  }

  function handleConfirmAllPacked() {
    setConfirmError(null);
    startConfirmTransition(async () => {
      const res = await confirmAllPacked(order.id);
      if (!res.ok) {
        setConfirmError(res.error);
        return;
      }
      setConfirmedPacked(true);
    });
  }

  return (
    <Card className="border-line shadow-none">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <p className="font-display text-lg">{order.orderNumber}</p>
          <p className="text-sm text-stone">{order.shippingName ?? "Shipping name not yet captured"}</p>
        </div>
      </CardHeader>
      <CardContent>
        <Table className="mb-5">
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Print</TableHead>
              <TableHead>Edition #</TableHead>
              <TableHead>Confirmed</TableHead>
              <TableHead>Drawer / location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="h-28 w-28 overflow-hidden border border-line bg-white">
                    {item.primaryImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-stone">
                        No image
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{item.title}</TableCell>
                <TableCell className="text-lg font-bold">{item.editionLabel}</TableCell>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={item.editionConfirmedByPacker}
                    onChange={(e) => handleToggleEdition(item.id, e.target.checked)}
                    disabled={confirmedPacked}
                    className="h-5 w-5 accent-ink"
                    aria-label={`Confirm edition number for ${item.title}`}
                  />
                </TableCell>
                <TableCell className="text-lg font-bold">{item.drawerLocation ?? "Unfiled — check with Product"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {order.costs.customsPlaceholder && (
          <p className="text-xs text-accent mb-3">
            One or more of these prints is missing weight/customs details (Admin &gt; Products &gt; edit the
            print) — the UPS quote and customs paperwork for this order are using generic placeholders.
          </p>
        )}

        {!confirmedPacked ? (
          <div className="space-y-3">
            <div>
              <Button type="button" variant="secondary" onClick={handlePrintCoa} disabled={coaPending}>
                {coaPending ? "Generating…" : allCoaPrinted ? "Print COA again" : "Print COA"}
              </Button>
              {coaError && <p className="mt-2 text-xs text-accent">{coaError}</p>}
            </div>

            {allCoaPrinted && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleConfirmAllPacked}
                  disabled={confirmPending || !allConfirmed}
                >
                  {confirmPending ? "Confirming…" : "Confirm all packed"}
                </Button>
                {!allConfirmed && (
                  <p className="mt-2 text-xs text-stone">Tick the edition number for every item first.</p>
                )}
                {confirmError && <p className="mt-2 text-xs text-accent">{confirmError}</p>}
              </div>
            )}
          </div>
        ) : (
          <PackCarrierPicker
            orderId={order.id}
            packAction={printLabel}
            royalMail={order.costs.royalMail}
            royalMailError={order.costs.royalMailError}
            ups={order.costs.ups}
            upsError={order.costs.upsError}
            currency={order.currency}
            requiresCustoms={order.costs.requiresCustoms}
            defaultDims={order.costs.defaultDims}
            defaultCustomsValueMinor={order.costs.defaultCustomsValueMinor}
          />
        )}
      </CardContent>
    </Card>
  );
}
