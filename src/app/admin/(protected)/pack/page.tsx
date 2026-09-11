import { prisma } from "@/lib/prisma";
import { PackButton } from "@/components/admin/PackButton";
import { markOrderPacked } from "./actions";

export const dynamic = "force-dynamic";

export default async function PackPage() {
  const orders = await prisma.order.findMany({
    where: { status: "PAID" },
    orderBy: { createdAt: "asc" },
    include: { items: { include: { print: true, edition: { include: { location: true } } } } },
  });

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Packing queue</h1>
      <p className="text-stone text-sm mb-8">
        {orders.length} order{orders.length === 1 ? "" : "s"} waiting to be packed. No pricing shown here —
        just what to pick and where from.
      </p>

      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order.id} className="border hairline p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-display text-lg">{order.orderNumber}</p>
                <p className="text-sm text-stone">{order.shippingName ?? "Shipping name not yet captured"}</p>
              </div>
              <PackButton orderId={order.id} action={markOrderPacked} />
            </div>

            <table className="w-full text-sm">
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
                      {item.edition ? `#${item.edition.number}` : "Not assigned"}
                    </td>
                    <td className="py-2">{item.edition?.location?.code ?? "Unfiled — check with Stock"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {orders.length === 0 && (
          <p className="text-stone text-center py-16">Nothing to pack right now.</p>
        )}
      </div>
    </div>
  );
}
