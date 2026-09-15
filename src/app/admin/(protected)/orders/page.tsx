import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { AutoRefresh } from "@/components/admin/AutoRefresh";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "text-stone",
  PAID: "text-accent",
  PACKING: "text-accent",
  PACKED: "text-ink",
  SHIPPED: "text-ink",
  CANCELLED: "text-stone line-through",
  REFUNDED: "text-stone line-through",
};

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: true, items: true },
  });

  return (
    <div>
      <AutoRefresh />
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="font-display text-2xl">Orders</h1>
        <Link href="/admin/orders/new" className="btn-secondary">
          + New manual order
        </Link>
      </div>
      <div className="border hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left border-b hairline">
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Courier</th>
              <th className="p-3">Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b hairline last:border-0 hover:bg-line/40">
                <td className="p-3">
                  <Link href={`/admin/orders/${order.id}`} className="underline">
                    {order.orderNumber}
                  </Link>
                  {order.source === "MANUAL" && (
                    <span className="label-caps text-stone ml-2 border hairline px-1.5 py-0.5">Manual</span>
                  )}
                  {order.withdrawnAt && (
                    <span className="label-caps text-accent ml-2 border border-accent px-1.5 py-0.5">
                      Withdrawal requested
                    </span>
                  )}
                </td>
                <td className="p-3">{order.customer.email}</td>
                <td className="p-3">{order.items.length}</td>
                <td className="p-3">{formatMinor(order.totalMinor, order.currency)}</td>
                <td className={`p-3 ${STATUS_STYLES[order.status]}`}>{order.status.replace("_", " ")}</td>
                <td className="p-3 text-stone">
                  {order.courierStatus ?? (order.shippingCarrier !== "UNASSIGNED" ? order.shippingCarrier : "—")}
                </td>
                <td className="p-3 text-stone">{order.createdAt.toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-stone">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
