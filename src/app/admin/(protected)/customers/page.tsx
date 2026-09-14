import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { OWNED_STATUSES } from "@/lib/customer-collection";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined,
    include: {
      orders: { select: { status: true, totalMinor: true, currency: true, createdAt: true } },
    },
    take: 300,
  });

  // Sorted by most recent activity (last order, or date joined for someone
  // with no orders yet) rather than a plain DB order-by, since that's a
  // more useful default for a staff member scanning the client list.
  const rows = customers
    .map((customer) => {
      const realizedOrders = customer.orders.filter((o) => OWNED_STATUSES.includes(o.status));
      const lifetimeSpendMinor = realizedOrders.reduce((sum, o) => sum + o.totalMinor, 0);
      const currency = realizedOrders[0]?.currency ?? customer.orders[0]?.currency ?? "GBP";
      const lastOrderAt = customer.orders.reduce<Date | null>(
        (latest, o) => (!latest || o.createdAt > latest ? o.createdAt : latest),
        null
      );
      return { customer, orderCount: customer.orders.length, lifetimeSpendMinor, currency, lastOrderAt };
    })
    .sort((a, b) => {
      const aTime = (a.lastOrderAt ?? a.customer.createdAt).getTime();
      const bTime = (b.lastOrderAt ?? b.customer.createdAt).getTime();
      return bTime - aTime;
    });

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="font-display text-2xl">Clients</h1>
        <p className="text-xs text-stone">{customers.length} total</p>
      </div>

      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, or phone"
          className="border hairline bg-transparent px-3 py-2 text-sm w-full max-w-lg focus:outline-none focus:border-ink"
        />
      </form>

      <div className="border hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left border-b hairline">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Lifetime spend</th>
              <th className="p-3">Marketing</th>
              <th className="p-3">Account</th>
              <th className="p-3">Last order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ customer, orderCount, lifetimeSpendMinor, currency, lastOrderAt }) => {
              const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
              return (
                <tr key={customer.id} className="border-b hairline last:border-0 hover:bg-line/40">
                  <td className="p-3">
                    <Link href={`/admin/customers/${customer.id}`} className="underline">
                      {name || "—"}
                    </Link>
                  </td>
                  <td className="p-3">{customer.email}</td>
                  <td className="p-3 text-stone">{customer.phone ?? "—"}</td>
                  <td className="p-3">{orderCount}</td>
                  <td className="p-3">{lifetimeSpendMinor > 0 ? formatMinor(lifetimeSpendMinor, currency) : "—"}</td>
                  <td className="p-3 text-stone">{customer.marketingOptIn ? "Opted in" : "—"}</td>
                  <td className="p-3 text-stone">{customer.passwordHash ? "Registered" : "Guest"}</td>
                  <td className="p-3 text-stone">{lastOrderAt ? lastOrderAt.toLocaleDateString("en-GB") : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-stone">
                  {q ? "No clients match that search." : "No clients yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
