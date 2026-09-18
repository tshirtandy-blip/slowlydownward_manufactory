import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { editionSummary } from "@/lib/editions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductStatusTabs } from "@/components/admin/products/ProductStatusTabs";
import { ProductTableRow } from "@/components/admin/products/ProductTableRow";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: { q?: string; offset?: string; status?: string };
}) {
  const q = searchParams.q?.trim();
  const offset = Math.max(0, Number(searchParams.offset) || 0);
  const status = searchParams.status === "published" || searchParams.status === "draft" ? searchParams.status : "all";
  const qAsNumber = q && !isNaN(Number(q)) ? Number(q) : null;

  const orConditions = q
    ? [
        { title: { contains: q, mode: "insensitive" as const } },
        { drawerLocation: { contains: q, mode: "insensitive" as const } },
        ...(qAsNumber !== null ? [{ editions: { some: { number: qAsNumber } } }] : []),
      ]
    : [];

  const where = {
    ...(q ? { OR: orConditions } : {}),
    ...(status === "published" ? { published: true } : status === "draft" ? { published: false } : {}),
  };

  const [prints, totalProducts] = await Promise.all([
    prisma.print.findMany({
      where,
      include: { editions: { select: { status: true } } },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: PAGE_SIZE,
    }),
    prisma.print.count({ where }),
  ]);

  const rangeStart = totalProducts === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, totalProducts);
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  function pageHref(newOffset: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (newOffset > 0) params.set("offset", String(newOffset));
    const qs = params.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl">Product</h1>
        <Button asChild>
          <Link href="/admin/products/new">Add product</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <ProductStatusTabs status={status} />
        <form className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name, edition number, or drawer"
            className="border-line pl-9"
          />
        </form>
      </div>

      <Card className="border-line shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal">Products</CardTitle>
          <CardDescription>Manage your catalogue, pricing, and edition stock.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">
                  <span className="sr-only">Image</span>
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prints.map((print) => {
                const available = print.editions.filter((e) => e.status === "AVAILABLE").length;
                return (
                  <ProductTableRow
                    key={print.id}
                    id={print.id}
                    title={print.title}
                    imageUrl={print.primaryImageUrl}
                    price={formatMinor(print.priceMinor, print.currency)}
                    stock={editionSummary(available, print.editionSize)}
                    published={print.published}
                  />
                );
              })}
            </TableBody>
          </Table>
          {prints.length === 0 && <p className="py-12 text-center text-sm text-stone">No products found.</p>}
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-stone">
              Showing <strong className="text-ink">{rangeStart}-{rangeEnd}</strong> of{" "}
              <strong className="text-ink">{totalProducts}</strong> products
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
              {nextOffset >= totalProducts ? (
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
