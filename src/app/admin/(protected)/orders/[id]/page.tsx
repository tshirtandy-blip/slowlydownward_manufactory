import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { include: { print: true, edition: { include: { location: true } } } },
      packedBy: true,
    },
  });
  if (!order) notFound();

  const address = order.shippingAddress as any;

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="font-display text-2xl">{order.orderNumber}</h1>
        <span className="label-caps">{order.status.replace("_", " ")}</span>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
        <div>
          <h2 className="label-caps mb-2">Customer</h2>
          <p>{order.customer.email}</p>
        </div>
        <div>
          <h2 className="label-caps mb-2">Shipping to</h2>
          {order.shippingName && <p>{order.shippingName}</p>}
          {address ? (
            <p className="text-stone">
              {[address.line1, address.line2, address.city, address.postal_code, address.country]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : (
            <p className="text-stone">Not yet captured</p>
          )}
          {order.trackingNumber && (
            <p className="mt-1">
              Tracking: {order.trackingNumber} ({order.shippingCarrier})
            </p>
          )}
        </div>
      </div>

      <h2 className="label-caps mb-3">Items</h2>
      <div className="border hairline mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left border-b hairline">
              <th className="p-3">Print</th>
              <th className="p-3">Edition</th>
              <th className="p-3">Location</th>
              <th className="p-3">Price</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b hairline last:border-0">
                <td className="p-3">{item.print.title}</td>
                <td className="p-3">
                  {item.edition ? `#${item.edition.number} / ${item.print.editionSize}` : "Not yet assigned"}
                </td>
                <td className="p-3">{item.edition?.location?.code ?? "—"}</td>
                <td className="p-3">{formatMinor(item.unitPriceMinor, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end text-sm space-y-1 flex-col items-end">
        <p>Subtotal: {formatMinor(order.subtotalMinor, order.currency)}</p>
        <p>Shipping: {formatMinor(order.shippingMinor, order.currency)}</p>
        <p className="text-lg mt-1">Total: {formatMinor(order.totalMinor, order.currency)}</p>
      </div>

      {(order.xeroInvoiceId || order.mailchimpSynced) && (
        <div className="mt-8 text-xs text-stone space-x-4">
          {order.xeroInvoiceId && <span>Xero invoice created</span>}
          {order.mailchimpSynced && <span>Synced to Mailchimp</span>}
        </div>
      )}
    </div>
  );
}
