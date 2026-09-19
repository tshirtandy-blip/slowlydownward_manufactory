import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { OWNED_STATUSES } from "@/lib/customer-collection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

// Sorting is by most recent activity (last order, or date joined for
// someone with no orders yet), which isn't a plain DB column — so, as
// before, this fetches a capped batch and sorts/pages it in memory rather
// than doing it at the database level.
const FETCH_CAP = 500;
const PAGE_SIZE = 25;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; offset?: string };
}) {
  const q = searchParams.q?.trim();
  const offset = Math.max(0, Number(searchParams.offset) || 0);
  // Match each typed word independently against any field, rather than the
  // whole query string against a single field — otherwise "Mandip Bhattal"
  // finds nobody, since firstName ("Mandip") and lastName ("Bhattal") are
  // separate columns and neither alone contains the full two-word string.
  const searchTokens = q ? q.split(/\s+/).filter(Boolean) : [];

  const customers = await prisma.customer.findMany({
    where: searchTokens.length
      ? {
          AND: searchTokens.map((token) => ({
            OR: [
              { email: { contains: token, mode: "insensitive" as const } },
              { firstName: { contains: token, mode: "insensitive" as const } },
              { lastName: { contains: token, mode: "insensitive" as const } },
              { phone: { contains: token, mode: "insensitive" as const } },
            ],
          })),
        }
      : undefined,
    include: {
      orders: { select: { status: true, totalMinor: true, currency: true, createdAt: true } },
    },
    take: FETCH_CAP,
  });

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

  const totalCustomers = rows.length;
  const pageRows = rows.slice(offset, offset + PAGE_SIZE);
  const rangeStart = totalCustomers === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, totalCustomers);
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  function pageHref(newOffset: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (newOffset > 0) params.set("offset", String(newOffset));
    const qs = params.toString();
    return qs ? `/admin/customers?${qs}` : "/admin/customers";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl">Clients</h1>
        <p className="text-xs text-stone">
          {totalCustomers}
          {totalCustomers === FETCH_CAP ? "+" : ""} total
        </p>
      </div>

      <form className="relative mb-6 max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
        <Input type="text" name="q" defaultValue={q} placeholder="Search by name, email, or phone" className="border-line pl-9" />
      </form>

      <Card className="border-line shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal">Clients</CardTitle>
          <CardDescription>Every registered and guest customer, most recently active first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Lifetime spend</TableHead>
                <TableHead>Marketing</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Last order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map(({ customer, orderCount, lifetimeSpendMinor, currency, lastOrderAt }) => {
                const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                        {name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell className="text-stone">{customer.phone ?? "—"}</TableCell>
                    <TableCell>{orderCount}</TableCell>
                    <TableCell>{lifetimeSpendMinor > 0 ? formatMinor(lifetimeSpendMinor, currency) : "—"}</TableCell>
                    <TableCell>
                      {customer.marketingOptIn ? (
                        <Badge variant="outline">Opted in</Badge>
                      ) : (
                        <span className="text-stone">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.passwordHash ? "Registered" : "Guest"}</Badge>
                    </TableCell>
                    <TableCell className="text-stone">
                      {lastOrderAt ? lastOrderAt.toLocaleDateString("en-GB") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {pageRows.length === 0 && (
            <p className="py-12 text-center text-sm text-stone">
              {q ? "No clients match that search." : "No clients yet."}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-stone">
              Showing <strong className="text-ink">{rangeStart}-{rangeEnd}</strong> of{" "}
              <strong className="text-ink">{totalCustomers}</strong> clients
            </p>
            <div className="flex gap-2">
              {offset === 0 ? (
                <Button variant="ghost" size="sm" disabled>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </Button>
              ) : (
                <Button asChild variant="ghost" size="sm">
                  <Link href={pageHref(prevOffset)}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Prev
                  </Link>
                </Button>
              )}
              {nextOffset >= totalCustomers ? (
                <Button variant="ghost" size="sm" disabled>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button asChild variant="ghost" size="sm">
                  <Link href={pageHref(nextOffset)}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
