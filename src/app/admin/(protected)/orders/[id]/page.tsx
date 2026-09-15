import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatMinor } from "@/lib/money";
import { CourierStatusEditor } from "@/components/admin/CourierStatusEditor";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { ManualOrderPanel } from "@/components/admin/ManualOrderPanel";
import { ShippingLabelPreview } from "@/components/admin/ShippingLabelPreview";
import { ResetOrderTestingButton } from "@/components/admin/ResetOrderTestingButton";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: { include: { print: true, edition: true } },
      packedBy: true,
      createdBy: true,
    },
  });
  if (!order) notFound();

  const address = order.shippingAddress as any;

  // If any item's requested edition number couldn't be honoured, the
  // webhook records exactly why (see src/lib/editions.ts / the stripe
  // webhook route) — pull those up so the reason shows right here instead
  // of just "requested #X" with no explanation of what happened to it.
  const mismatchLogs = await prisma.auditLog.findMany({
    where: { entityType: "Order", entityId: order.id, action: "requested_edition_unavailable" },
  });
  const mismatchReasonByItemId = new Map<string, string>();
  for (const log of mismatchLogs) {
    const meta = log.meta as any;
    if (meta?.orderItemId && meta?.reason) mismatchReasonByItemId.set(meta.orderItemId, meta.reason);
  }

  return (
    <div className="max-w-3xl">
      <AutoRefresh />
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-2xl">{order.orderNumber}</h1>
        <span className="label-caps">{order.status.replace("_", " ")}</span>
      </div>

      {order.source === "MANUAL" && (
        <p className="text-xs text-stone mb-6">
          Manual order{order.createdBy ? ` — created by ${order.createdBy.name}` : ""}, not from the storefront.
        </p>
      )}

      {order.source === "MANUAL" && (
        <ManualOrderPanel
          orderId={order.id}
          initialPaymentLinkUrl={order.paymentLinkUrl}
          initialPaymentLinkSentAt={order.paymentLinkSentAt ? order.paymentLinkSentAt.toISOString() : null}
          customerEmail={order.customer.email}
          canCancel={order.status === "PENDING_PAYMENT"}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8 text-sm">
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
            <div className="mt-1">
              <ShippingLabelPreview
                labelUrl={order.labelUrl}
                trackingNumber={order.trackingNumber}
                carrier={order.shippingCarrier}
              />
            </div>
          )}
          {address && (
            <a
              href={`/admin/orders/${order.id}/commercial-invoice`}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline hover:text-ink mt-2 inline-block"
            >
              View commercial invoice (PDF)
            </a>
          )}
        </div>
        <div>
          <h2 className="label-caps mb-2">Courier status</h2>
          <CourierStatusEditor
            orderId={order.id}
            initialStatus={order.courierStatus}
            hasTrackingNumber={!!order.trackingNumber}
          />
          {order.courierStatusAt && (
            <p className="text-xs text-stone mt-1">
              Updated {order.courierStatusAt.toLocaleString("en-GB")}
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
                  {item.edition
                    ? `#${item.edition.number} / ${item.print.editionSize}`
                    : item.print.editionSize === null
                    ? "Open edition"
                    : item.requestedEditionNumber != null && order.status === "PENDING_PAYMENT"
                    ? `#${item.requestedEditionNumber} / ${item.print.editionSize} — held, awaiting payment`
                    : "Not yet assigned"}
                  {/* Only shown when it actually differs from what was assigned —
                      e.g. the customer's chosen number was taken by the time
                      payment completed, so the next available one was used
                      instead (see allocateEdition in src/lib/editions.ts). */}
                  {item.requestedEditionNumber != null &&
                    item.edition?.number !== item.requestedEditionNumber && (
                      <>
                        <p className="text-xs text-accent mt-1">
                          Customer requested #{item.requestedEditionNumber}
                        </p>
                        {mismatchReasonByItemId.has(item.id) && (
                          <p className="text-xs text-stone mt-0.5">{mismatchReasonByItemId.get(item.id)}</p>
                        )}
                      </>
                    )}
                </td>
                <td className="p-3">{item.print.drawerLocation ?? "—"}</td>
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

      {session?.user.role === "ADMIN" && order.status !== "PENDING_PAYMENT" && (
        <ResetOrderTestingButton orderId={order.id} />
      )}
    </div>
  );
}
