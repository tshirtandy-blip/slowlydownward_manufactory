import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { editionSummary } from "@/lib/editions";

export const dynamic = "force-dynamic";

export default async function StockPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const qAsNumber = q && !isNaN(Number(q)) ? Number(q) : null;

  const orConditions = q
    ? [
        { title: { contains: q, mode: "insensitive" as const } },
        { editions: { some: { location: { code: { contains: q, mode: "insensitive" as const } } } } },
        ...(qAsNumber !== null ? [{ editions: { some: { number: qAsNumber } } }] : []),
      ]
    : [];

  const prints = await prisma.print.findMany({
    where: q ? { OR: orConditions } : undefined,
    include: { editions: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl">Stock</h1>
        <Link href="/admin/stock/new" className="btn-primary !px-4 !py-2">
          Add print
        </Link>
      </div>

      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by print name, edition number, or drawer code (e.g. C3-D5)"
          className="border hairline bg-transparent px-3 py-2 text-sm w-full max-w-lg focus:outline-none focus:border-ink"
        />
      </form>

      <div className="border hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left border-b hairline">
              <th className="p-3">Print</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Published</th>
            </tr>
          </thead>
          <tbody>
            {prints.map((print) => {
              const available = print.editions.filter((e) => e.status === "AVAILABLE").length;
              return (
                <tr key={print.id} className="border-b hairline last:border-0 hover:bg-line/40">
                  <td className="p-3">
                    <Link href={`/admin/stock/${print.id}`} className="underline">
                      {print.title}
                    </Link>
                  </td>
                  <td className="p-3">{formatMinor(print.priceMinor, print.currency)}</td>
                  <td className="p-3">{editionSummary(available, print.editionSize)}</td>
                  <td className="p-3 text-stone">{print.published ? "Yes" : "Draft"}</td>
                </tr>
              );
            })}
            {prints.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-stone">
                  No prints found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
