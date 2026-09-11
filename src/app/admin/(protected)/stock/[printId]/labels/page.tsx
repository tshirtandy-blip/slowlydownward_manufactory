import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export default async function LabelSheetPage({ params }: { params: { printId: string } }) {
  const print = await prisma.print.findUnique({
    where: { id: params.printId },
    include: { editions: { orderBy: { number: "asc" }, include: { location: true } } },
  });
  if (!print) notFound();

  const labels = await Promise.all(
    print.editions.map(async (edition) => ({
      number: edition.number,
      location: edition.location?.code ?? "",
      qr: await QRCode.toDataURL(`sd:edition:${edition.id}`, { margin: 0, width: 96 }),
    }))
  );

  return (
    <div>
      <div className="no-print flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl">Label sheet — {print.title}</h1>
        <PrintButton />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {labels.map((label) => (
          <div key={label.number} className="border border-black p-3 flex items-center gap-3 break-inside-avoid">
            <img src={label.qr} alt="" width={48} height={48} />
            <div>
              <p className="text-xs font-semibold">{print.title}</p>
              <p className="text-sm">Edition #{label.number} / {print.editionSize}</p>
              <p className="text-xs text-stone">{label.location || "Unfiled"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
