import { prisma } from "@/lib/prisma";
import { PackCarrierPicker } from "@/components/admin/PackCarrierPicker";
import { getCarrierCosts, packOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function PackPage() {
  const orders = await prisma.order.findMany({
    where: { status: "PAID" },
    orderBy: { createdAt: "asc" },
    include: { items: { include: { print: true, edition: true } } },
  });

  const costs = await Promise.all(orders.map((o) => getCarrierCosts(o.id)));

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Packing queue</h1>
      <p className="text-stone text-sm mb-8">
        {orders.length} order{orders.length === 1 ? "" : "s"} waiting to be packed. Pick a carrier for each — both
        costs are calculated from the order's actual weight, where connected.
      </p>

      <div className="space-y-6">
        {orders.map((order, i) => (
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
                    <td className="py-2">{item.print.title}</td>
                    <td className="py-2 font-medium">
                      {item.edition
                        ? `#${item.edition.number}`
                        : item.print.editionSize === null
                        ? "Open edition"
                        : "Not assigned"}
                    </td>
                    <td className="py-2">{item.print.drawerLocation ?? "Unfiled — check with Product"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {costs[i].customsPlaceholder && (
              <p className="text-xs text-accent mb-3">
                One or more of these prints is missing weight/customs details (Admin &gt; Products &gt; edit the
                print) — the UPS quote and customs paperwork for this order are using generic placeholders.
              </p>
            )}

            <PackCarrierPicker
              orderId={order.id}
              packAction={packOrder}
              royalMail={costs[i].royalMail}
              royalMailError={costs[i].royalMailError}
              ups={costs[i].ups}
              upsError={costs[i].upsError}
              currency={order.currency}
              requiresCustoms={costs[i].requiresCustoms}
              defaultDims={costs[i].defaultDims}
              defaultCustomsValueMinor={costs[i].defaultCustomsValueMinor}
            />
          </div>
        ))}

        {orders.length === 0 && (
          <p className="text-stone text-center py-16">Nothing to pack right now.</p>
        )}
      </div>
    </div>
  );
}
