import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { COUNTRIES } from "@/lib/countries";
import { getCustomerCollection, OWNED_STATUSES } from "@/lib/customer-collection";

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

function countryName(code: string | null | undefined) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      orders: { include: { items: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();

  const collection = await getCustomerCollection(customer.id);

  const realizedOrders = customer.orders.filter((o) => OWNED_STATUSES.includes(o.status));
  const lifetimeSpendMinor = realizedOrders.reduce((sum, o) => sum + o.totalMinor, 0);
  const currency = realizedOrders[0]?.currency ?? customer.orders[0]?.currency ?? "GBP";
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return (
    <div className="max-w-4xl">
      <Link href="/admin/customers" className="text-xs underline text-stone hover:text-ink">
        ← Clients
      </Link>

      <div className="flex items-baseline justify-between mt-3 mb-8">
        <h1 className="font-display text-2xl">{name || customer.email}</h1>
        <span className="label-caps text-stone">
          {customer.passwordHash ? "Registered account" : "Guest checkout"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-10 text-sm">
        <div>
          <h2 className="label-caps mb-2">Contact</h2>
          <p>{customer.email}</p>
          <p className="text-stone">{customer.phone ?? "No phone on file"}</p>
        </div>
        <div>
          <h2 className="label-caps mb-2">Marketing</h2>
          <p className="text-stone">{customer.marketingOptIn ? "Opted in to emails" : "Not opted in"}</p>
        </div>
        <div>
          <h2 className="label-caps mb-2">Orders</h2>
          <p>{customer.orders.length} total</p>
          <p className="text-stone">
            {lifetimeSpendMinor > 0 ? formatMinor(lifetimeSpendMinor, currency) : formatMinor(0, currency)} lifetime
            spend
          </p>
        </div>
        <div>
          <h2 className="label-caps mb-2">Client since</h2>
          <p className="text-stone">{customer.createdAt.toLocaleDateString("en-GB")}</p>
        </div>
      </div>

      {(customer.mailchimpId || customer.xeroContactId) && (
        <div className="mb-10 text-xs text-stone">
          <h2 className="label-caps mb-2 text-ink">Integrations</h2>
          <p>
            {customer.mailchimpId ? "Synced to Mailchimp" : "Not synced to Mailchimp"}
            {customer.xeroContactId ? " · Has a Xero contact" : ""}
          </p>
        </div>
      )}

      <h2 className="label-caps mb-3">Saved addresses</h2>
      {customer.addresses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {customer.addresses.map((address) => (
            <div key={address.id} className="border hairline p-4 text-sm">
              <p className="label-caps mb-1">
                {address.label || "Address"}
                {address.isDefault && <span className="text-stone"> · Default</span>}
              </p>
              <p>{address.fullName}</p>
              <p className="text-stone">
                {[
                  address.line1,
                  address.line2,
                  address.city,
                  address.region,
                  address.postalCode,
                  countryName(address.countryCode),
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {address.phone && <p className="text-stone">{address.phone}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone mb-10">No saved addresses.</p>
      )}

      <h2 className="label-caps mb-3">Collection ({collection.length})</h2>
      {collection.length > 0 ? (
        <div className="border hairline mb-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="label-caps text-left border-b hairline">
                <th className="p-3">Print</th>
                <th className="p-3">Edition</th>
                <th className="p-3">Order</th>
                <th className="p-3">Purchased</th>
              </tr>
            </thead>
            <tbody>
              {collection.map((piece) => (
                <tr key={piece.orderItemId} className="border-b hairline last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/products/${piece.printId}`} className="underline">
                      {piece.printTitle}
                    </Link>
                  </td>
                  <td className="p-3 text-stone">
                    {piece.editionNumber != null
                      ? `#${piece.editionNumber}${piece.editionSize ? ` / ${piece.editionSize}` : ""}`
                      : "Open edition"}
                  </td>
                  <td className="p-3 text-stone">{piece.orderNumber}</td>
                  <td className="p-3 text-stone">{piece.purchasedAt.toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-stone mb-10">No paid orders yet.</p>
      )}

      <h2 className="label-caps mb-3">Order history</h2>
      <div className="border hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left border-b hairline">
              <th className="p-3">Order</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Placed</th>
            </tr>
          </thead>
          <tbody>
            {customer.orders.map((order) => (
              <tr key={order.id} className="border-b hairline last:border-0 hover:bg-line/40">
                <td className="p-3">
                  <Link href={`/admin/orders/${order.id}`} className="underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="p-3">{order.items.length}</td>
                <td className="p-3">{formatMinor(order.totalMinor, order.currency)}</td>
                <td className={`p-3 ${STATUS_STYLES[order.status]}`}>{order.status.replace("_", " ")}</td>
                <td className="p-3 text-stone">{order.createdAt.toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
            {customer.orders.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-stone">
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
