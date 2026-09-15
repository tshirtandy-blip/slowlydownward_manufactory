"use client";

import { useState } from "react";
import { PackCarrierPicker } from "./PackCarrierPicker";
import { packOrder } from "@/app/admin/(protected)/pack/actions";

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
        <div key={order.id} className="border hairline p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-display text-lg">{order.orderNumber}</p>
              <p className="text-sm text-stone">{order.shippingName ?? "Shipping name not yet captured"}</p>
            </div>
          </div>

          <table className="w-full text-sm mb-5">
            <thead>
              <tr className="label-caps text-left border-b hairline">
                <th className="py-2">Print</th>
                <th className="py-2">Edition #</th>
                <th className="py-2">Drawer / location</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b hairline last:border-0">
                  <td className="py-2">{item.title}</td>
                  <td className="py-2 font-medium">{item.editionLabel}</td>
                  <td className="py-2">{item.drawerLocation ?? "Unfiled — check with Product"}</td>
                </tr>
              ))}
            </tbody>
          </table>

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
        </div>
      ))}

      {orders.length === 0 && <p className="text-stone text-center py-16">Nothing to pack right now.</p>}
    </div>
  );
}
