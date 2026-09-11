import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatMinor } from "@/lib/money";
import { editionSummary } from "@/lib/editions";
import { EditionRow } from "@/components/admin/EditionRow";
import { togglePublished } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrintDetailPage({
  params,
  searchParams,
}: {
  params: { printId: string };
  searchParams: { status?: string };
}) {
  const print = await prisma.print.findUnique({
    where: { id: params.printId },
    include: {
      editions: {
        where: searchParams.status ? { status: searchParams.status as any } : undefined,
        include: { location: true, orderItem: { include: { order: { include: { customer: true } } } } },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!print) notFound();

  const allEditions = await prisma.edition.findMany({ where: { printId: print.id }, select: { status: true } });
  const available = allEditions.filter((e) => e.status === "AVAILABLE").length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl mb-1">{print.title}</h1>
          <p className="text-stone text-sm">
            {formatMinor(print.priceMinor, print.currency)} — {editionSummary(available, print.editionSize)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/stock/${print.id}/labels`} className="btn-secondary !px-4 !py-2">
            Print label sheet
          </Link>
          <form action={togglePublished.bind(null, print.id, !print.published)}>
            <button className="btn-secondary !px-4 !py-2">
              {print.published ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>

      <div className="flex gap-2 mb-4 label-caps">
        <Link href={`/admin/stock/${print.id}`} className={!searchParams.status ? "text-ink" : "text-stone"}>
          All
        </Link>
        {["AVAILABLE", "SOLD", "RESERVED", "WITHHELD", "DAMAGED"].map((s) => (
          <Link
            key={s}
            href={`/admin/stock/${print.id}?status=${s}`}
            className={searchParams.status === s ? "text-ink" : "text-stone"}
          >
            {s}
          </Link>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="label-caps text-left border-b hairline">
            <th className="py-2">Number</th>
            <th className="py-2">Status</th>
            <th className="py-2">Drawer / location</th>
          </tr>
        </thead>
        <tbody>
          {print.editions.map((edition) => (
            <EditionRow
              key={edition.id}
              id={edition.id}
              number={edition.number}
              status={edition.status}
              locationCode={edition.location?.code}
              soldTo={edition.orderItem?.order.customer.email}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
