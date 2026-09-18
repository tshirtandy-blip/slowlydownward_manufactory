import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { COUNTRIES } from "@/lib/countries";
import { getCustomerCollection, OWNED_STATUSES } from "@/lib/customer-collection";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

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
            <Card key={address.id} className="border-line text-sm shadow-none">
              <CardContent className="p-4">
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone mb-10">No saved addresses.</p>
      )}

      <h2 className="label-caps mb-3">Collection ({collection.length})</h2>
      {collection.length > 0 ? (
        <Card className="mb-10 border-line shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Print</TableHead>
                  <TableHead>Edition</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Purchased</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collection.map((piece) => (
                  <TableRow key={piece.orderItemId}>
                    <TableCell>
                      <Link href={`/admin/products/${piece.printId}`} className="hover:underline">
                        {piece.printTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-stone">
                      {piece.editionNumber != null
                        ? `#${piece.editionNumber}${piece.editionSize ? ` / ${piece.editionSize}` : ""}`
                        : "Open edition"}
                    </TableCell>
                    <TableCell className="text-stone">{piece.orderNumber}</TableCell>
                    <TableCell className="text-stone">{piece.purchasedAt.toLocaleDateString("en-GB")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-stone mb-10">No paid orders yet.</p>
      )}

      <h2 className="label-caps mb-3">Order history</h2>
      <Card className="border-line shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{order.items.length}</TableCell>
                  <TableCell>{formatMinor(order.totalMinor, order.currency)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-stone">{order.createdAt.toLocaleDateString("en-GB")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {customer.orders.length === 0 && <p className="py-8 text-center text-sm text-stone">No orders yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
