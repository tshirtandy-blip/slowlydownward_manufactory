"use client";

import { useState } from "react";
import { PackCarrierPicker } from "./PackCarrierPicker";
import { packOrder } from "@/app/admin/(protected)/pack/actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    editionLabel: string;
    drawerLocation: string | null;
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
 * from fresh props on every render. Packing an order (via the server
 * action below) makes Next.js silently re-run this page's server
 * component afterwards regardless of which paths are revalidated, and
 * since a just-packed order no longer matches the "still awaiting
 * packing" query, a version of this list built straight from live server
 * data would drop that order's whole card — label, print button, or any
 * error message included — before there was any real chance to see it.
 * Freezing the list here means a packed order just stays in place,
 * showing whatever PackCarrierPicker renders for it, until the packer
 * next reloads or navigates back to this page. */
export function PackQueueList({ initialOrders }: { initialOrders: PackQueueRow[] }) {
  const [orders] = useState(initialOrders);

  return (
    <div className="space-y-6">
      {orders.map((order) => (
        <Card key={order.id} className="border-line shadow-none">
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
                  <TableHead>Print</TableHead>
                  <TableHead>Edition #</TableHead>
                  <TableHead>Drawer / location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell className="font-medium">{item.editionLabel}</TableCell>
                    <TableCell>{item.drawerLocation ?? "Unfiled — check with Product"}</TableCell>
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

            <PackCarrierPicker
              orderId={order.id}
              packAction={packOrder}
              royalMail={order.costs.royalMail}
              royalMailError={order.costs.royalMailError}
              ups={order.costs.ups}
              upsError={order.costs.upsError}
              currency={order.currency}
              requiresCustoms={order.costs.requiresCustoms}
              defaultDims={order.costs.defaultDims}
              defaultCustomsValueMinor={order.costs.defaultCustomsValueMinor}
            />
          </CardContent>
        </Card>
      ))}

      {orders.length === 0 && <p className="text-stone text-center py-16">Nothing to pack right now.</p>}
    </div>
  );
}
