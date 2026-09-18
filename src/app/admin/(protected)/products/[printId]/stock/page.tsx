import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { editionSummary } from "@/lib/editions";
import { releaseExpiredReservations } from "@/lib/edition-reservations";
import { EditionRow } from "@/components/admin/EditionRow";
import { DrawerLocationEditor } from "@/components/admin/DrawerLocationEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function StockDetailsPage({
  params,
  searchParams,
}: {
  params: { printId: string };
  searchParams: { status?: string };
}) {
  // So a hold that's simply timed out doesn't still show as RESERVED here.
  await releaseExpiredReservations(prisma, params.printId);

  const print = await prisma.print.findUnique({
    where: { id: params.printId },
    include: {
      editions: {
        where: searchParams.status ? { status: searchParams.status as any } : undefined,
        include: { orderItem: { include: { order: { include: { customer: true } } } } },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!print) notFound();

  const allEditions = await prisma.edition.findMany({ where: { printId: print.id }, select: { status: true } });
  const available = allEditions.filter((e) => e.status === "AVAILABLE").length;

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/products/${print.id}`} className="label-caps text-stone hover:text-ink">
        ← {print.title}
      </Link>

      <div className="flex items-start justify-between mb-8 mt-2 gap-4">
        <div>
          <h1 className="font-display text-2xl mb-1">Stock — {print.title}</h1>
          <p className="text-stone text-sm">{editionSummary(available, print.editionSize)}</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={`/admin/products/${print.id}/labels`}>Print label sheet</Link>
        </Button>
      </div>

      <div className="mb-8">
        <label className="label-caps block mb-2">Drawer / location</label>
        <p className="text-xs text-stone mb-2">
          Every copy of this edition is stored together, so there's just one drawer for the whole print.
        </p>
        <DrawerLocationEditor printId={print.id} initial={print.drawerLocation ?? ""} />
      </div>

      {print.editionSize === null ? (
        <p className="text-sm text-stone border border-line p-4">
          This is an open edition — not limited or numbered, so there are no individual numbered copies to
          list here. Switch it back to a number on the product's own page if you'd like to track numbered
          stock for it after all.
        </p>
      ) : (
        <>
          <div className="flex gap-2 mb-4 label-caps">
            <Link
              href={`/admin/products/${print.id}/stock`}
              className={!searchParams.status ? "text-ink" : "text-stone"}
            >
              All
            </Link>
            {["AVAILABLE", "SOLD", "RESERVED", "WITHHELD", "DAMAGED"].map((s) => (
              <Link
                key={s}
                href={`/admin/products/${print.id}/stock?status=${s}`}
                className={searchParams.status === s ? "text-ink" : "text-stone"}
              >
                {s}
              </Link>
            ))}
          </div>

          <Card className="border-line shadow-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {print.editions.map((edition) => (
                    <EditionRow
                      key={edition.id}
                      id={edition.id}
                      number={edition.number}
                      status={edition.status}
                      soldTo={edition.orderItem?.order.shippingName ?? edition.orderItem?.order.customer.email}
                    />
                  ))}
                </TableBody>
              </Table>
              {print.editions.length === 0 && (
                <p className="py-8 text-center text-sm text-stone">No editions match this filter.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
