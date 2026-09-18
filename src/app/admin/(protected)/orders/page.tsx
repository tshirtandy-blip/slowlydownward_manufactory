import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// Same status -> colour meaning as before, just applied to a Badge instead
// of plain text.
const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING_PAYMENT: "text-stone border-line",
  PAID: "text-accent border-accent",
  PACKING: "text-accent border-accent",
  PACKED: "text-ink border-ink",
  SHIPPED: "text-ink border-ink",
  CANCELLED: "text-stone border-line line-through",
  REFUNDED: "text-stone border-line line-through",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { q?: string; offset?: string };
}) {
  const q = searchParams.q?.trim();
  const offset = Math.max(0, Number(searchParams.offset) || 0);

  const where = q
    ? {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" as const } },
          { customer: { email: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : undefined;

  const [orders, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: PAGE_SIZE,
      include: { customer: true, items: true },
    }),
    prisma.order.count({ where }),
  ]);

  const rangeStart = totalOrders === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, totalOrders);
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  function pageHref(newOffset: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (newOffset > 0) params.set("offset", String(newOffset));
    const qs = params.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  }

  return (
    <div>
      <AutoRefresh />
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl">Orders</h1>
        <Button asChild variant="outline">
          <Link href="/admin/orders/new">+ New manual order</Link>
        </Button>
      </div>

      <form className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
        <Input type="text" name="q" defaultValue={q} placeholder="Search by order number or email" className="border-line pl-9" />
      </form>

      <Card className="border-line shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal">Orders</CardTitle>
          <CardDescription>All orders placed through the storefront and manual entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                    {order.source === "MANUAL" && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Manual
                      </Badge>
                    )}
                    {order.withdrawnAt && (
                      <Badge variant="outline" className="ml-2 border-accent text-[10px] text-accent">
                        Withdrawal requested
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{order.customer.email}</TableCell>
                  <TableCell>{order.items.length}</TableCell>
                  <TableCell>{formatMinor(order.totalMinor, order.currency)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[order.status]}>
                      {order.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-stone">
                    {order.courierStatus ?? (order.shippingCarrier !== "UNASSIGNED" ? order.shippingCarrier : "—")}
                  </TableCell>
                  <TableCell className="text-stone">{order.createdAt.toLocaleDateString("en-GB")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {orders.length === 0 && <p className="py-12 text-center text-sm text-stone">No orders found.</p>}
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-stone">
              Showing <strong className="text-ink">{rangeStart}-{rangeEnd}</strong> of{" "}
              <strong className="text-ink">{totalOrders}</strong> orders
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
              {nextOffset >= totalOrders ? (
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
