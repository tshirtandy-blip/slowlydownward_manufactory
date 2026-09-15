import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { AccountNav } from "@/components/account/AccountNav";
import { formatMinor } from "@/lib/money";
import { getSiteSettings } from "@/lib/site-settings";
import { OrderWithdrawalAction } from "./OrderWithdrawalAction";

const NOT_WITHDRAWABLE_STATUSES = new Set(["PENDING_PAYMENT", "CANCELLED", "REFUNDED"]);

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PACKING: "Being packed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export default async function OrderHistoryPage() {
  const session = await getServerSession(authOptions);
  const customer = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
  if (!customer) redirect("/account/login");

  const [footer, settings, orders] = await Promise.all([
    getFooterProps(),
    getSiteSettings(),
    prisma.order.findMany({
      where: { customerId: (customer as any).id },
      include: { items: { include: { print: true, edition: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="font-display text-3xl mb-8">Order history</h1>
        <AccountNav active="/account/orders" />
        {orders.length === 0 ? (
          <p className="text-stone">You haven't placed an order yet.</p>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="border hairline p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <div>
                    <p className="font-display text-lg">{order.orderNumber}</p>
                    <p className="text-xs text-stone">
                      {order.createdAt.toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="label-caps">{STATUS_LABELS[order.status] ?? order.status}</span>
                </div>
                <ul className="text-sm mb-3">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between py-1 border-b hairline last:border-0">
                      <span>
                        {item.print.title}
                        {item.edition ? ` — edition #${item.edition.number}` : ""}
                      </span>
                      <span>{formatMinor(item.unitPriceMinor, order.currency)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between text-sm gap-2">
                  <p className="text-stone">
                    {order.trackingNumber
                      ? `Tracking: ${order.trackingNumber}${
                          order.shippingCarrier !== "UNASSIGNED" ? ` (${order.shippingCarrier})` : ""
                        }`
                      : ""}
                  </p>
                  <p className="font-medium">Total: {formatMinor(order.totalMinor, order.currency)}</p>
                </div>
                {order.withdrawnAt ? (
                  <p className="text-xs text-stone mt-3">
                    Withdrawal requested{" "}
                    {order.withdrawnAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                    .
                  </p>
                ) : (
                  !NOT_WITHDRAWABLE_STATUSES.has(order.status) && (
                    <OrderWithdrawalAction
                      orderId={order.id}
                      orderNumber={order.orderNumber}
                      placedOn={order.createdAt.toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      totalFormatted={formatMinor(order.totalMinor, order.currency)}
                      withdrawalPeriodDays={settings.withdrawalPeriodDays}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
