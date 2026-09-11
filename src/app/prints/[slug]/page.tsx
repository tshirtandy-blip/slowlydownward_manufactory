import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { formatMinor } from "@/lib/money";
import { editionSummary } from "@/lib/editions";
import { AddToCartForm } from "@/components/storefront/AddToCartForm";

export const dynamic = "force-dynamic";

async function getPrint(slug: string) {
  return prisma.print.findUnique({
    where: { slug },
    include: {
      editions: { where: { status: "AVAILABLE" }, select: { number: true }, orderBy: { number: "asc" } },
    },
  });
}

export default async function PrintPage({ params }: { params: { slug: string } }) {
  const print = await getPrint(params.slug);
  if (!print || !print.published) notFound();

  const availableNumbers = print.editions.map((e) => e.number);

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="relative aspect-[4/5] bg-white border hairline">
          {print.primaryImageUrl ? (
            <Image
              src={print.primaryImageUrl}
              alt={print.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone">
              No image
            </div>
          )}
        </div>

        <div>
          <p className="label-caps mb-2">{print.artist}</p>
          <h1 className="font-display text-3xl md:text-4xl mb-4">{print.title}</h1>
          <p className="text-lg mb-1">{formatMinor(print.priceMinor, print.currency)}</p>
          <p className="label-caps mb-6">
            {editionSummary(availableNumbers.length, print.editionSize)}
          </p>

          {print.description && (
            <p className="text-stone mb-6 leading-relaxed">{print.description}</p>
          )}

          <dl className="text-sm text-stone mb-8 space-y-1">
            {print.technique && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Technique</dt>
                <dd>{print.technique}</dd>
              </div>
            )}
            {print.dimensions && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Dimensions</dt>
                <dd>{print.dimensions}</dd>
              </div>
            )}
            {print.year && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0">Year</dt>
                <dd>{print.year}</dd>
              </div>
            )}
          </dl>

          <AddToCartForm
            printId={print.id}
            slug={print.slug}
            title={print.title}
            priceMinor={print.priceMinor}
            currency={print.currency}
            imageUrl={print.primaryImageUrl ?? undefined}
            availableNumbers={availableNumbers}
          />
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
