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
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
        <OrderStatusBadge status={order.status} />
      </div>

      {order.source === "MANUAL" && (
        <p className="text-xs text-stone mb-6">
          Manual order{order.createdBy ? ` — created by ${order.createdBy.name}` : ""}, not from the storefront.
        </p>
      )}

      {order.withdrawnAt && (
        <div className="border border-accent p-4 mb-6">
          <p className="text-sm font-medium text-accent mb-1">Customer requested to withdraw from this order</p>
          <p className="text-xs text-stone">
            Requested{" "}
            {order.withdrawnAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })} — their right to
            cancel, no reason required. Arrange the return and refund, then update this order's status once it's
            sorted.
          </p>
          {order.withdrawalReason && (
            <p className="text-xs text-stone mt-2">Note from customer: "{order.withdrawalReason}"</p>
          )}
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-sm">
        <Card className="border-line shadow-none">
          <CardHeader className="pb-2">
            <h2 className="label-caps">Customer</h2>
          </CardHeader>
          <CardContent>
            <p>{order.customer.email}</p>
          </CardContent>
        </Card>
        <Card className="border-line shadow-none">
          <CardHeader className="pb-2">
            <h2 className="label-caps">Shipping to</h2>
          </CardHeader>
          <CardContent>
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
                className="text-xs underline hover:text-ink mt-2 block"
              >
                View commercial invoice (PDF)
              </a>
            )}
            <a
              href={`/admin/orders/${order.id}/coa`}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline hover:text-ink mt-2 block"
            >
              View/reprint Certificate of Authenticity (PDF)
            </a>
          </CardContent>
        </Card>
        <Card className="border-line shadow-none">
          <CardHeader className="pb-2">
            <h2 className="label-caps">Courier status</h2>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      <h2 className="label-caps mb-3">Items</h2>
      <Card className="mb-8 border-line shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Print</TableHead>
                <TableHead>Edition</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.print.title}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>{item.print.drawerLocation ?? "—"}</TableCell>
                  <TableCell>{formatMinor(item.unitPriceMinor, order.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
