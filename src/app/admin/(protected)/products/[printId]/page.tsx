import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatMinor } from "@/lib/money";
import { editionSummary } from "@/lib/editions";
import { togglePublished, deletePrint } from "../actions";
import { ProductEditForm } from "@/components/admin/ProductEditForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: { params: { printId: string } }) {
  const [print, mediumOptions] = await Promise.all([
    prisma.print.findUnique({
      where: { id: params.printId },
      include: { editions: { select: { status: true } } },
    }),
    prisma.mediumOption.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!print) notFound();

  const available = print.editions.filter((e) => e.status === "AVAILABLE").length;
  const imageUrls = Array.isArray(print.imageUrls) ? (print.imageUrls as string[]) : [];

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <Link href="/admin/products" className="label-caps text-stone hover:text-ink">
            ← Product
          </Link>
          <h1 className="font-display text-2xl mt-2 mb-1">{print.title}</h1>
          <p className="text-stone text-sm">
            {formatMinor(print.priceMinor, print.currency)} — {editionSummary(available, print.editionSize)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href={`/admin/products/${print.id}/stock`} className="btn-secondary !px-4 !py-2">
            Stock
          </Link>
          <form action={togglePublished.bind(null, print.id, !print.published)}>
            <button className="btn-secondary !px-4 !py-2">{print.published ? "Unpublish" : "Publish"}</button>
          </form>
        </div>
      </div>

      <ProductEditForm
        key={print.updatedAt.getTime()}
        initial={{
          id: print.id,
          title: print.title,
          artist: print.artist,
          description: print.description,
          technique: print.technique,
          paperSize: print.paperSize,
          imageSize: print.imageSize,
          medium: print.medium,
          editionSize: print.editionSize,
          year: print.year,
          priceMinor: print.priceMinor,
          currency: print.currency,
          primaryImageUrl: print.primaryImageUrl,
          imageUrls,
          weightGrams: print.weightGrams,
          lengthCm: print.lengthCm,
          widthCm: print.widthCm,
          heightCm: print.heightCm,
          customsValueMinor: print.customsValueMinor,
          customsDescription: print.customsDescription,
          customsCode: print.customsCode,
        }}
        mediumOptions={mediumOptions.map((m) => m.name)}
      />

      <p className="text-xs text-stone mt-8">
        Want to add extra content below the price/photo box on this product's page — more photos, a longer
        story, a quote?{" "}
        <Link href={`/admin/pages/products/${print.id}`} className="underline hover:text-ink">
          Edit its extra page content
        </Link>
        .
      </p>

      <form action={deletePrint.bind(null, print.id)} className="mt-4 pt-4 border-t hairline">
        <ConfirmSubmitButton
          confirmText={`Delete "${print.title}"? This can't be undone.`}
          className="text-xs text-stone hover:text-accent"
        >
          Delete this product
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
